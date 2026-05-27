import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const mapParser = require('../public/preload/map_parser.js')

test('parses GNU ld output sections without double counting input sections', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
RAM              0x20000000         0x00020000         xrw
FLASH            0x08000000         0x00100000         xr
*default*        0x00000000         0xffffffff

Linker script and memory map

.isr_vector     0x08000000      0x188
 *(.isr_vector)
 .isr_vector    0x08000000      0x188 startup.o
                0x08000000                g_pfnVectors

.text           0x08000190      0x100
 *(.text)
 .text          0x08000190       0x40 crtbegin.o
 .text.main     0x080001d0       0xc0 main.o
                0x080001d0                main

.rodata         0x08000290       0x20
 *(.rodata*)
 .rodata.str1.4
                0x08000290       0x20 main.o

.data           0x20000000       0x10 load address 0x080002b0
 *(.data*)
 .data          0x20000000       0x10 main.o
                0x20000000                counter

.bss            0x20000010       0x30 load address 0x080002c0
 *(.bss*)
 .bss.buffer    0x20000010       0x30 main.o
                0x20000010                buffer
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  assert.deepEqual(parsed.sections.map((section) => section.name), [
    '.isr_vector',
    '.text',
    '.rodata',
    '.data',
    '.bss',
  ])
  assert.equal(parsed.totals.code, 0x188 + 0x100)
  assert.equal(parsed.totals.roData, 0x20)
  assert.equal(parsed.totals.rwData, 0x10)
  assert.equal(parsed.totals.ziData, 0x30)
  assert.equal(parsed.totals.flashUsed, 0x188 + 0x100 + 0x20 + 0x10)
  assert.equal(parsed.totals.ramUsed, 0x10 + 0x30)
  assert.ok(parsed.modules.find((module) => module.name === 'main.o'))
})

test('parses Keil symbol sizes as decimal values', () => {
  const content = `
ARM Linker, 6.18
Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00001234, Max: 0x00040000, ABSOLUTE)
  Execution Region ER_IROM1 (Base: 0x08000000, Size: 0x00001000, Max: 0x00040000, ABSOLUTE)
  Execution Region RW_IRAM1 (Base: 0x20000000, Size: 0x00000200, Max: 0x00010000, ABSOLUTE)

Global Symbols

Symbol Name                              Value     Ov Type        Size  Object(Section)
main                                    0x08000101   Thumb Code   256  main.o(.text)
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'Keil')
  assert.equal(parsed.memoryRegions.find((region) => region.name === 'LR_IROM1')?.length, 0x40000)
  assert.equal(parsed.memoryRegions.find((region) => region.name === 'LR_IROM1')?.used, 0x1234)
  assert.equal(parsed.memoryRegions.find((region) => region.name === 'RW_IRAM1')?.length, 0x10000)
  assert.equal(parsed.symbols.find((symbol) => symbol.name === 'main')?.size, 256)
})

test('parses Keil ARMCC component totals and execution region capacities', () => {
  const content = `
Component: ARM Compiler 5.06 update 7 (build 960) Tool: armlink [4d3601]

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00004c9c, Max: 0x00010000, ABSOLUTE)

    Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00004ba0, Max: 0x00010000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000130   Data   RO            3    RESET               startup_stm32f10x_hd.o

    Execution Region RW_IRAM1 (Exec base: 0x20000000, Load base: 0x08004ba0, Size: 0x00001fc8, Max: 0x00010000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x20000000   0x08004ba0   0x000000fc   Data   RW         3555    .data               shell.o
    0x200000fc   0x08004c9c   0x00001ecc   Zero   RW         3556    .bss                shell.o

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name

       4480        246        413         88         48      41183   shell.o
        484        186         18          0         24      15049   main.o

    ----------------------------------------------------------------------
      13504       1826       1744        240       7880     429397   Object Totals

    ----------------------------------------------------------------------

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Library Member Name

       2344        100          0          0          0        700   printfa.o
          0          0          0          8          0          0   mvars.o

    ----------------------------------------------------------------------
       4112        136          0         12          4       2440   Library Totals

    ----------------------------------------------------------------------

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Library Name

       3042        136          0         12          0       1784   mc_w.l
       1066          0          0          0          0        656   mf_w.l

==============================================================================

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug

     17616       1962       1744        252       7884     421797   Grand Totals
     17616       1962       1744        252       7884     421797   ELF Image Totals
     17616       1962       1744        252          0          0   ROM Totals

    Total RO  Size (Code + RO Data)                19360 (  18.91kB)
    Total RW  Size (RW Data + ZI Data)              8136 (   7.95kB)
    Total ROM Size (Code + RO Data + RW Data)      19612 (  19.15kB)
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'Keil')
  assert.equal(parsed.totals.code, 17616)
  assert.equal(parsed.totals.roData, 1744)
  assert.equal(parsed.totals.rwData, 252)
  assert.equal(parsed.totals.ziData, 7884)
  assert.equal(parsed.totals.flashUsed, 19612)
  assert.equal(parsed.totals.ramUsed, 8136)
  assert.equal(parsed.memoryRegions.find((region) => region.name === 'LR_IROM1')?.length, 0x10000)
  assert.equal(parsed.memoryRegions.find((region) => region.name === 'ER_IROM1')?.length, 0x10000)
  assert.equal(parsed.memoryRegions.find((region) => region.name === 'RW_IRAM1')?.length, 0x10000)
  assert.equal(parsed.memoryRegions.find((region) => region.name === 'RW_IRAM1')?.used, 0x1fc8)
  assert.equal(parsed.modules.find((module) => module.name === 'shell.o')?.code, 4480)
  assert.equal(parsed.modules.find((module) => module.name === 'Object Totals'), undefined)
  assert.equal(parsed.modules.find((module) => module.name === 'Library Totals'), undefined)
  assert.equal(parsed.modules.find((module) => module.name === 'mc_w.l'), undefined)
})

test('Keil Grand Totals with thousand-separator spaces', () => {
  const content = `
ARM Linker

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name

       100          0          0          0          0          0   main.o

    ======================================================================

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug

     1 234          0          5       2 000      3 000          0   Grand Totals

    Total RO  Size (Code + RO Data)                 1239 (   1.21kB)
    Total RW  Size (RW Data + ZI Data)              5000 (   4.88kB)
    Total ROM Size (Code + RO Data + RW Data)       3239 (   3.16kB)
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.totals.code, 1234)
  assert.equal(parsed.totals.roData, 5)
  assert.equal(parsed.totals.rwData, 2000)
  assert.equal(parsed.totals.ziData, 3000)
})

test('Keil padding and generated lines included in totals fallback', () => {
  const content = `
ARM Linker

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name

       100          0          0          0          0          0   main.o
        50          0          0          0          0          0   utils.o

    ----------------------------------------------------------------------
       150          0          0          0          0          0   Object Totals
         0          0          2          0          0          0   (incl. Generated)
        10          0          2          4          0          0   (incl. Padding)

    ----------------------------------------------------------------------
        30          0          0          0          0          0   lib.o

    ----------------------------------------------------------------------
        30          0          0          0          0          0   Library Totals
         4          0          0          0          4          0   (incl. Padding)

    ----------------------------------------------------------------------
`
  const parsed = mapParser.parse(content)

  // Without Grand Totals, totals = module sums + padding/generated
  // modules: code=100+50+30=180, ro=0, rw=0, zi=0
  // padding: code=10+4=14, ro=0, rw=2+0=2, zi=0
  // generated: code=0, ro=0, rw=2, zi=0
  // library padding: code=4, ro=0, rw=0, zi=4
  // totals: code=194, ro=0, rw=4, zi=4
  assert.equal(parsed.totals.code, 194)
  assert.equal(parsed.totals.roData, 0)
  assert.equal(parsed.totals.rwData, 4)
  assert.equal(parsed.totals.ziData, 4)
  assert.equal(parsed.totals.flashUsed, 194 + 0 + 4)
  assert.equal(parsed.totals.ramUsed, 4 + 4)
})

test('Keil fallback symbol filter allows __ prefixed symbols', () => {
  const content = `
ARM Linker

Global Symbols

Symbol Name                              Value     Ov Type        Size  Object(Section)

    __test_sym                              0x08000100
    _printf_flags                           0x00000000   Number         0  stubs.o ABSOLUTE
`
  const parsed = mapParser.parse(content)

  // __test_sym should be captured by fallback (non-standard format)
  const sym = parsed.symbols.find(s => s.name === '__test_sym')
  assert.ok(sym, '__ prefixed symbol should be captured by fallback')
  assert.equal(sym.address, 0x08000100)
})

// ============================================================
// 格式检测测试
// ============================================================

test('detectFormat returns GCC for GNU LD content', () => {
  assert.equal(mapParser.detectFormat('Memory Configuration\nGNU LD'), 'GCC')
  assert.equal(mapParser.detectFormat('MEMORY CONFIGURATION'), 'GCC')
})

test('detectFormat returns Keil for ARM Linker content', () => {
  assert.equal(mapParser.detectFormat('ARM Linker, 6.18'), 'Keil')
  assert.equal(mapParser.detectFormat('Component Sizes'), 'Keil')
})

test('detectFormat returns IAR for IAR Linker content', () => {
  assert.equal(mapParser.detectFormat('IAR Linker'), 'IAR')
  assert.equal(mapParser.detectFormat('ENTRY  MODULE  ADDRESS'), 'IAR')
})

test('detectFormat defaults to GCC for unknown content', () => {
  assert.equal(mapParser.detectFormat(''), 'GCC')
  assert.equal(mapParser.detectFormat(null), 'GCC')
  assert.equal(mapParser.detectFormat('unknown format'), 'GCC')
})

// ============================================================
// GCC 格式完整测试
// ============================================================

test('GCC parses symbols with size information', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.text           0x08000000      0x200
 .text          0x08000000       0x40 crtbegin.o
 .text.main     0x08000040      0x100 main.o
                0x08000040                main
                0x08000140                __bss_start__
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  const mainSym = parsed.symbols.find(s => s.name === 'main')
  assert.ok(mainSym, 'main symbol should be parsed')
  assert.equal(mainSym.address, 0x08000040)
})

test('GCC tracks module contributions from input sections', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.text           0x08000000      0x200
 *(.text)
 .text          0x08000000       0x40 crtbegin.o
 .text.main     0x08000040      0x100 main.o

.rodata         0x08000200       0x20
 *(.rodata*)
 .rodata.str1.4
                0x08000200       0x20 main.o

.data           0x20000000       0x10 load address 0x08000220
 *(.data*)
 .data          0x20000000       0x10 main.o

.bss            0x20000010       0x30
 *(.bss*)
 .bss.buffer    0x20000010       0x30 main.o
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  assert.ok(parsed.modules.length > 0, 'modules should be parsed')

  const mainModule = parsed.modules.find(m => m.name === 'main.o')
  assert.ok(mainModule, 'main.o module should exist')
  assert.equal(mainModule.code, 0x100)
  assert.equal(mainModule.ro_data, 0x20)
  assert.equal(mainModule.rw_data, 0x10)
  assert.equal(mainModule.zi_data, 0x30)
})

test('GCC calculates memory region used values', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.text           0x08000000      0x1000
 .text          0x08000000       0x1000 main.o

.data           0x20000000       0x100 load address 0x08001000
 .data          0x20000000       0x100 main.o

.bss            0x20000100       0x200
 .bss           0x20000100       0x200 main.o
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  const flashRegion = parsed.memoryRegions.find(r => r.name === 'FLASH')
  const ramRegion = parsed.memoryRegions.find(r => r.name === 'RAM')

  assert.ok(flashRegion, 'FLASH region should exist')
  assert.ok(ramRegion, 'RAM region should exist')
  assert.equal(flashRegion.used, 0x1000 + 0x100) // .text + .data load address
  assert.equal(ramRegion.used, 0x100 + 0x200) // .data + .bss
})

test('GCC parses .data load address correctly', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.data           0x20000000       0x100 load address 0x080002b0
 .data          0x20000000       0x100 main.o
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  const dataSection = parsed.sections.find(s => s.name === '.data')
  assert.ok(dataSection, '.data section should exist')
  assert.equal(dataSection.address, 0x20000000)
  assert.equal(dataSection.size, 0x100)
  assert.equal(dataSection.loadAddress, 0x080002b0)
})

test('GCC filters linker directives properly', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.text           0x08000000      0x100
 .text          0x08000000       0x100 main.o
                0x08000000                . = ALIGN (0x10)
                0x08000010                PROVIDE (__bss_start__ = .)
                0x08000010                . = ALIGN (0x4)
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  // 链接器指令不应该被解析为符号
  const alignSym = parsed.symbols.find(s => s.name.includes('ALIGN'))
  assert.equal(alignSym, undefined, 'ALIGN directive should not be parsed as symbol')

  const provideSym = parsed.symbols.find(s => s.name.includes('PROVIDE'))
  assert.equal(provideSym, undefined, 'PROVIDE directive should not be parsed as symbol')
})

test('GCC handles empty content gracefully', () => {
  const parsed = mapParser.parse('')

  assert.equal(parsed.formatType, 'GCC')
  assert.deepEqual(parsed.symbols, [])
  assert.deepEqual(parsed.sections, [])
  assert.deepEqual(parsed.modules, [])
  assert.deepEqual(parsed.memoryRegions, [])
  assert.equal(parsed.totals.code, 0)
  assert.equal(parsed.totals.roData, 0)
  assert.equal(parsed.totals.rwData, 0)
  assert.equal(parsed.totals.ziData, 0)
})

test('GCC handles null content gracefully', () => {
  const parsed = mapParser.parse(null)

  assert.equal(parsed.formatType, 'GCC')
  assert.deepEqual(parsed.symbols, [])
  assert.deepEqual(parsed.sections, [])
})

// ============================================================
// IAR 格式完整测试
// ============================================================

test('IAR parses module summary with Code/Data/Const columns', () => {
  const content = `
IAR ELF Linker V8.32.1

**** MODULE SUMMARY ****

Module           Code    Data   Const
main.o            256      32      16
utils.o           128      64       0
startup.o          64       0       0
-------------------------------------------------
Total:            448      96      16

**** ENTRY LIST ****

Entry            Address   Size  Type   Scope
main             0x08000100   256  Code   Gb
utils_init       0x08000200    48  Code   Gb
data_buffer      0x20000000    32  Data   Gb
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'IAR')
  assert.equal(parsed.modules.length, 3)

  const mainModule = parsed.modules.find(m => m.name === 'main.o')
  assert.ok(mainModule, 'main.o module should exist')
  assert.equal(mainModule.code, 256)
  assert.equal(mainModule.rw_data, 32)
  assert.equal(mainModule.ro_data, 16)

  const utilsModule = parsed.modules.find(m => m.name === 'utils.o')
  assert.ok(utilsModule, 'utils.o module should exist')
  assert.equal(utilsModule.code, 128)
  assert.equal(utilsModule.rw_data, 64)
  assert.equal(utilsModule.ro_data, 0)
})

test('IAR parses entry list with type and scope', () => {
  const content = `
IAR ELF Linker V8.32.1

**** MODULE SUMMARY ****

Module           Code    Data   Const
main.o            256      32      16

**** ENTRY LIST ****

Entry            Address   Size  Type   Scope
main             0x08000100   256  Code   Gb
local_func       0x08000200    48  Code   Lc
static_var       0x20000000    32  Data   St
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'IAR')
  assert.equal(parsed.symbols.length, 3)

  const mainSym = parsed.symbols.find(s => s.name === 'main')
  assert.ok(mainSym, 'main symbol should exist')
  assert.equal(mainSym.address, 0x08000100)
  assert.equal(mainSym.size, 256)
  assert.equal(mainSym.type, '函数')
  assert.equal(mainSym.scope, 'Global')

  const localFunc = parsed.symbols.find(s => s.name === 'local_func')
  assert.ok(localFunc, 'local_func symbol should exist')
  assert.equal(localFunc.scope, 'Local')

  const staticVar = parsed.symbols.find(s => s.name === 'static_var')
  assert.ok(staticVar, 'static_var symbol should exist')
  assert.equal(staticVar.type, '变量')
  assert.equal(staticVar.scope, 'Static')
})

test('IAR handles thousand-separator spaces in numbers', () => {
  const content = `
IAR ELF Linker V8.32.1

**** MODULE SUMMARY ****

Module           Code    Data   Const
main.o          4 096   1 024    512
utils.o         2 048     256    128

**** ENTRY LIST ****

Entry            Address   Size  Type   Scope
main             0x08000100  4 096  Code   Gb
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'IAR')

  const mainModule = parsed.modules.find(m => m.name === 'main.o')
  assert.ok(mainModule, 'main.o module should exist')
  assert.equal(mainModule.code, 4096)
  assert.equal(mainModule.rw_data, 1024)
  assert.equal(mainModule.ro_data, 512)

  const mainSym = parsed.symbols.find(s => s.name === 'main')
  assert.ok(mainSym, 'main symbol should exist')
  assert.equal(mainSym.size, 4096)
})

test('IAR infers memory regions from modules', () => {
  const content = `
IAR ELF Linker V8.32.1

**** MODULE SUMMARY ****

Module           Code    Data   Const
main.o            256      32      16
utils.o           128      64       0

**** ENTRY LIST ****

Entry            Address   Size  Type   Scope
main             0x08000100   256  Code   Gb
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'IAR')
  assert.ok(parsed.memoryRegions.length > 0, 'memory regions should be inferred')

  const flashRegion = parsed.memoryRegions.find(r => /FLASH/i.test(r.name))
  const ramRegion = parsed.memoryRegions.find(r => /RAM/i.test(r.name))

  assert.ok(flashRegion, 'FLASH region should be inferred')
  assert.ok(ramRegion, 'RAM region should be inferred')

  // flashUsed = code + ro_data + rw_data = (256+128) + (16+0) + (32+64) = 496
  assert.equal(parsed.totals.flashUsed, 496)
  // ramUsed = rw_data + zi_data = (32+64) + 0 = 96
  assert.equal(parsed.totals.ramUsed, 96)
})

test('IAR parses complex MAP file with multiple modules', () => {
  const content = `
IAR ELF Linker V8.32.1

**** MODULE SUMMARY ****

Module           Code    Data   Const
main.o           1024     128      64
stm32f1xx_it.o    256      16       0
system_stm32f1xx.o 128      32      16
startup.o          64       0       0
printfa.o         512       0       0
-------------------------------------------------
Total:           1984     176      80

**** ENTRY LIST ****

Entry            Address   Size  Type   Scope
main             0x08000100  1024  Code   Gb
SystemInit       0x08000500   128  Code   Gb
USART1_IRQHandler 0x08000600   256  Code   Gb
__iar_program_start 0x08000700    64  Code   Gb
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'IAR')
  assert.equal(parsed.modules.length, 5)
  // __iar_program_start 以 __ 开头被过滤，实际只有 3 个符号
  assert.equal(parsed.symbols.length, 3)

  // 验证 totals
  assert.equal(parsed.totals.code, 1984)
  assert.equal(parsed.totals.roData, 80)
  assert.equal(parsed.totals.rwData, 176)
  assert.equal(parsed.totals.ziData, 0)
  assert.equal(parsed.totals.flashUsed, 1984 + 80 + 176)
  assert.equal(parsed.totals.ramUsed, 176 + 0)
})

test('IAR handles empty module summary', () => {
  const content = `
IAR ELF Linker V8.32.1

**** MODULE SUMMARY ****

Module           Code    Data   Const
-------------------------------------------------
Total:             0       0       0

**** ENTRY LIST ****

Entry            Address   Size  Type   Scope
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'IAR')
  assert.equal(parsed.modules.length, 0)
  assert.equal(parsed.symbols.length, 0)
  assert.equal(parsed.totals.code, 0)
})

test('IAR handles missing entry list', () => {
  const content = `
IAR ELF Linker V8.32.1

**** MODULE SUMMARY ****

Module           Code    Data   Const
main.o            256      32      16
-------------------------------------------------
Total:            256      32      16
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'IAR')
  assert.equal(parsed.modules.length, 1)
  assert.equal(parsed.symbols.length, 0)
})

// ============================================================
// GCC 格式全面测试
// ============================================================

test('GCC 完整 MAP 文件解析：验证所有字段', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw
*default*        0x00000000         0xffffffff

Linker script and memory map

.isr_vector     0x08000000      0x188
 *(.isr_vector)
 .isr_vector    0x08000000      0x188 startup_stm32f10x_hd.o
                0x08000000                g_pfnVectors

.text           0x08000190      0x2000
 *(.text*)
 .text          0x08000190       0x40 crtbegin.o
 .text          0x080001d0      0x1000 main.o
                0x080001d0                main
 .text          0x080011d0       0x80 system_stm32f10x.o
                0x080011d0                SystemInit
 .text          0x08001250       0x60 stm32f10x_it.o
                0x08001250                USART1_IRQHandler
 .text          0x080012b0       0x40 printfa.o

.rodata         0x08002190       0x200
 *(.rodata*)
 .rodata        0x08002190       0x100 main.o
 .rodata.str1.4
                0x08002290       0x100 system_stm32f10x.o

.data           0x20000000       0x100 load address 0x08002390
 *(.data*)
 .data          0x20000000        0x80 main.o
                0x20000000                counter
                0x20000080                global_flag
 .data          0x20000080        0x80 system_stm32f10x.o

.bss            0x20000100       0x400
 *(.bss*)
 .bss           0x20000100       0x200 main.o
                0x20000100                buffer
 .bss           0x20000300       0x100 stm32f10x_it.o
 .bss           0x20000400       0x100 system_stm32f10x.o

.heap           0x20000500       0x200
 *(.heap)
 .heap          0x20000500       0x200 crtbegin.o
`

  const parsed = mapParser.parse(content)

  // 格式类型
  assert.equal(parsed.formatType, 'GCC')

  // memoryRegions
  assert.equal(parsed.memoryRegions.length, 2)
  const flash = parsed.memoryRegions.find(r => r.name === 'FLASH')
  const ram = parsed.memoryRegions.find(r => r.name === 'RAM')
  assert.ok(flash, 'FLASH region should exist')
  assert.ok(ram, 'RAM region should exist')
  assert.equal(flash.origin, 0x08000000)
  assert.equal(flash.length, 0x00100000)
  assert.equal(flash.attributes, 'xr')
  assert.equal(ram.origin, 0x20000000)
  assert.equal(ram.length, 0x00020000)
  assert.equal(ram.attributes, 'xrw')

  // sections
  assert.deepEqual(parsed.sections.map(s => s.name), ['.isr_vector', '.text', '.rodata', '.data', '.bss', '.heap'])

  const isrSection = parsed.sections.find(s => s.name === '.isr_vector')
  assert.equal(isrSection.address, 0x08000000)
  assert.equal(isrSection.size, 0x188)
  assert.equal(isrSection.type, '代码')

  const textSection = parsed.sections.find(s => s.name === '.text')
  assert.equal(textSection.address, 0x08000190)
  assert.equal(textSection.size, 0x2000)

  const dataSection = parsed.sections.find(s => s.name === '.data')
  assert.equal(dataSection.address, 0x20000000)
  assert.equal(dataSection.size, 0x100)
  assert.equal(dataSection.loadAddress, 0x08002390)

  const bssSection = parsed.sections.find(s => s.name === '.bss')
  assert.equal(bssSection.address, 0x20000100)
  assert.equal(bssSection.size, 0x400)

  // modules
  const mainModule = parsed.modules.find(m => m.name === 'main.o')
  assert.ok(mainModule, 'main.o module should exist')
  assert.equal(mainModule.code, 0x1000) // .text contribution
  assert.equal(mainModule.ro_data, 0x100) // .rodata contribution
  assert.equal(mainModule.rw_data, 0x80) // .data contribution
  assert.equal(mainModule.zi_data, 0x200) // .bss contribution

  const sysModule = parsed.modules.find(m => m.name === 'system_stm32f10x.o')
  assert.ok(sysModule, 'system_stm32f10x.o module should exist')
  assert.equal(sysModule.code, 0x80)
  assert.equal(sysModule.ro_data, 0x100)
  assert.equal(sysModule.rw_data, 0x80)
  assert.equal(sysModule.zi_data, 0x100)

  // symbols
  const mainSym = parsed.symbols.find(s => s.name === 'main')
  assert.ok(mainSym, 'main symbol should be parsed')
  assert.equal(mainSym.address, 0x080001d0)

  const sysInitSym = parsed.symbols.find(s => s.name === 'SystemInit')
  assert.ok(sysInitSym, 'SystemInit symbol should be parsed')
  assert.equal(sysInitSym.address, 0x080011d0)

  const counterSym = parsed.symbols.find(s => s.name === 'counter')
  assert.ok(counterSym, 'counter symbol should be parsed')
  assert.equal(counterSym.address, 0x20000000)

  // totals（parseGCC 传 [] 给 computeTotals 的 modules 参数，所以从 sections 计算）
  // .heap 被 classifySection 归类为 BSS/zi，计入 ziData
  const expectedCode = 0x188 + 0x2000 // .isr_vector + .text
  const expectedRo = 0x200 // .rodata
  const expectedRw = 0x100 // .data
  const expectedZi = 0x400 + 0x200 // .bss + .heap
  assert.equal(parsed.totals.code, expectedCode)
  assert.equal(parsed.totals.roData, expectedRo)
  assert.equal(parsed.totals.rwData, expectedRw)
  assert.equal(parsed.totals.ziData, expectedZi)
  assert.equal(parsed.totals.flashUsed, expectedCode + expectedRo + expectedRw)
  assert.equal(parsed.totals.ramUsed, expectedRw + expectedZi)
})

test('GCC 多个 memory regions（FLASH, RAM, CCMRAM）', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00040000         xr
RAM              0x20000000         0x0000c000         xrw
CCMRAM           0x10000000         0x00004000         xrw

Linker script and memory map

.text           0x08000000      0x1000
 .text          0x08000000       0x800 main.o
 .text          0x08000800       0x800 utils.o

.data           0x20000000        0x80 load address 0x08001000
 .data          0x20000000        0x80 main.o

.bss            0x20000080       0x200
 .bss           0x20000080       0x100 main.o
 .bss           0x20000180       0x100 utils.o

.bss_ccm        0x10000000       0x800
 .bss_ccm       0x10000000       0x400 main.o
 .bss_ccm       0x10000400       0x400 utils.o
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  assert.equal(parsed.memoryRegions.length, 3)

  const flash = parsed.memoryRegions.find(r => r.name === 'FLASH')
  const ram = parsed.memoryRegions.find(r => r.name === 'RAM')
  const ccmram = parsed.memoryRegions.find(r => r.name === 'CCMRAM')

  assert.ok(flash, 'FLASH region should exist')
  assert.ok(ram, 'RAM region should exist')
  assert.ok(ccmram, 'CCMRAM region should exist')

  assert.equal(flash.origin, 0x08000000)
  assert.equal(flash.length, 0x00040000)
  assert.equal(ram.origin, 0x20000000)
  assert.equal(ram.length, 0x0000c000)
  assert.equal(ccmram.origin, 0x10000000)
  assert.equal(ccmram.length, 0x00004000)
  assert.equal(ccmram.attributes, 'xrw')

  // .text 在 FLASH 范围内
  assert.ok(0x08000000 >= flash.origin && 0x08000000 < flash.origin + flash.length)
  // .bss_ccm 在 CCMRAM 范围内
  assert.ok(0x10000000 >= ccmram.origin && 0x10000000 < ccmram.origin + ccmram.length)

  // .data load address 在 FLASH 中
  const dataSec = parsed.sections.find(s => s.name === '.data')
  assert.ok(dataSec, '.data section should exist')
  assert.equal(dataSec.loadAddress, 0x08001000)
})

test('GCC 空文件和异常输入：只有 Memory Configuration 没有 memory map', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw
*default*        0x00000000         0xffffffff
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  assert.equal(parsed.memoryRegions.length, 2)

  const flash = parsed.memoryRegions.find(r => r.name === 'FLASH')
  assert.ok(flash, 'FLASH region should exist')
  assert.equal(flash.origin, 0x08000000)
  assert.equal(flash.length, 0x00100000)

  // 没有 memory map 部分，不应有 sections/symbols/modules
  assert.equal(parsed.sections.length, 0)
  assert.equal(parsed.symbols.length, 0)
  assert.equal(parsed.modules.length, 0)
  assert.equal(parsed.totals.code, 0)
  assert.equal(parsed.totals.flashUsed, 0)
})

test('GCC 空文件和异常输入：只有 memory map 没有 Memory Configuration', () => {
  const content = `
Linker script and memory map

.text           0x08000000      0x100
 .text          0x08000000       0x80 main.o
 .text          0x08000080       0x80 utils.o

.data           0x20000000        0x40 load address 0x08000100
 .data          0x20000000        0x40 main.o
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')
  assert.equal(parsed.memoryRegions.length, 0)
  assert.equal(parsed.sections.length, 2)
  assert.equal(parsed.modules.length, 2)

  const mainModule = parsed.modules.find(m => m.name === 'main.o')
  assert.ok(mainModule, 'main.o module should exist')
  assert.equal(mainModule.code, 0x80)
  assert.equal(mainModule.rw_data, 0x40)

  // 没有 memoryRegions，totals 从 sections 计算
  assert.equal(parsed.totals.code, 0x100)
  assert.equal(parsed.totals.rwData, 0x40)
})

test('GCC 空文件和异常输入：空字符串', () => {
  const parsed = mapParser.parse('')

  assert.equal(parsed.formatType, 'GCC')
  assert.deepEqual(parsed.memoryRegions, [])
  assert.deepEqual(parsed.sections, [])
  assert.deepEqual(parsed.symbols, [])
  assert.deepEqual(parsed.modules, [])
  assert.equal(parsed.totals.code, 0)
  assert.equal(parsed.totals.roData, 0)
  assert.equal(parsed.totals.rwData, 0)
  assert.equal(parsed.totals.ziData, 0)
  assert.equal(parsed.totals.flashUsed, 0)
  assert.equal(parsed.totals.ramUsed, 0)
})

test('GCC 符号解析：带 size 的符号格式', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.text           0x08000000      0x400
 .text          0x08000000       0x40 crtbegin.o
 .text.main     0x08000040      0x100 main.o
                0x08000040                main
 .text.usart    0x08000140      0x200 stm32f10x_it.o
                0x08000140                USART1_IRQHandler
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')

  const mainSym = parsed.symbols.find(s => s.name === 'main')
  assert.ok(mainSym, 'main symbol should be parsed')
  assert.equal(mainSym.address, 0x08000040)
  assert.equal(mainSym.section, '.text')

  const usartSym = parsed.symbols.find(s => s.name === 'USART1_IRQHandler')
  assert.ok(usartSym, 'USART1_IRQHandler symbol should be parsed')
  assert.equal(usartSym.address, 0x08000140)
  assert.equal(usartSym.section, '.text')
})

test('GCC 符号解析：只有地址的符号格式', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.data           0x20000000        0x20 load address 0x08000100
 .data          0x20000000        0x20 main.o
                0x20000000                counter
                0x20000010                g_flag
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')

  const counterSym = parsed.symbols.find(s => s.name === 'counter')
  assert.ok(counterSym, 'counter symbol should be parsed')
  assert.equal(counterSym.address, 0x20000000)

  const flagSym = parsed.symbols.find(s => s.name === 'g_flag')
  assert.ok(flagSym, 'g_flag symbol should be parsed')
  assert.equal(flagSym.address, 0x20000010)
})

test('GCC 符号解析：跳过链接器伪指令（PROVIDE、EXTERN、ALIGN）', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.text           0x08000000      0x200
 .text          0x08000000       0x80 crtbegin.o
                0x08000080                . = ALIGN (0x10)
                0x08000090                PROVIDE (__bss_start__ = .)
                0x08000090                PROVIDE (__bss_end__ = .)
                0x08000090                EXTERN(__libc_init)
                0x08000090                main
                0x08000090                . = ALIGN (0x4)
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')

  // main 应该被解析
  const mainSym = parsed.symbols.find(s => s.name === 'main')
  assert.ok(mainSym, 'main symbol should be parsed')
  assert.equal(mainSym.address, 0x08000090)

  // 链接器伪指令不应被解析为符号
  assert.equal(parsed.symbols.find(s => s.name.includes('ALIGN')), undefined, 'ALIGN directive should not be a symbol')
  assert.equal(parsed.symbols.find(s => s.name.includes('PROVIDE')), undefined, 'PROVIDE directive should not be a symbol')
  assert.equal(parsed.symbols.find(s => s.name.includes('EXTERN')), undefined, 'EXTERN directive should not be a symbol')
  assert.equal(parsed.symbols.find(s => s.name.includes('__bss_start__')), undefined, 'PROVIDE(__bss_start__) should not be a symbol')
  assert.equal(parsed.symbols.find(s => s.name.includes('__bss_end__')), undefined, 'PROVIDE(__bss_end__) should not be a symbol')
  assert.equal(parsed.symbols.find(s => s.name.includes('__libc_init')), undefined, 'EXTERN(__libc_init) should not be a symbol')

  // 只有 main 一个有效符号
  assert.equal(parsed.symbols.length, 1)
  assert.equal(parsed.symbols[0].name, 'main')
})

test('GCC 模块贡献累积：同一模块在多个 section 中贡献', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.isr_vector     0x08000000      0x188
 .isr_vector    0x08000000      0x188 startup.o

.text           0x08000190      0x1000
 .text          0x08000190       0x200 main.o
 .text          0x08000390       0x100 stm32f10x_gpio.o
 .text          0x08000490       0x100 stm32f10x_usart.o

.rodata         0x08001190       0x100
 .rodata        0x08001190        0x80 main.o
 .rodata.str1.4
                0x08001210        0x80 stm32f10x_usart.o

.data           0x20000000        0x40 load address 0x08001290
 .data          0x20000000        0x20 main.o
 .data          0x20000020        0x20 stm32f10x_usart.o

.bss            0x20000040       0x100
 .bss           0x20000040        0x40 main.o
 .bss           0x20000080        0x40 stm32f10x_gpio.o
 .bss           0x200000c0        0x40 stm32f10x_usart.o
 .bss           0x20000100        0x40 startup.o
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')

  // 验证每个模块的各类型贡献被正确累加
  const mainModule = parsed.modules.find(m => m.name === 'main.o')
  assert.ok(mainModule, 'main.o module should exist')
  assert.equal(mainModule.code, 0x200, 'main.o code (.text)')
  assert.equal(mainModule.ro_data, 0x80, 'main.o ro_data (.rodata)')
  assert.equal(mainModule.rw_data, 0x20, 'main.o rw_data (.data)')
  assert.equal(mainModule.zi_data, 0x40, 'main.o zi_data (.bss)')

  const gpioModule = parsed.modules.find(m => m.name === 'stm32f10x_gpio.o')
  assert.ok(gpioModule, 'stm32f10x_gpio.o module should exist')
  assert.equal(gpioModule.code, 0x100, 'stm32f10x_gpio.o code (.text)')
  assert.equal(gpioModule.ro_data, 0, 'stm32f10x_gpio.o ro_data (none)')
  assert.equal(gpioModule.rw_data, 0, 'stm32f10x_gpio.o rw_data (none)')
  assert.equal(gpioModule.zi_data, 0x40, 'stm32f10x_gpio.o zi_data (.bss)')

  const usartModule = parsed.modules.find(m => m.name === 'stm32f10x_usart.o')
  assert.ok(usartModule, 'stm32f10x_usart.o module should exist')
  assert.equal(usartModule.code, 0x100, 'stm32f10x_usart.o code (.text)')
  assert.equal(usartModule.ro_data, 0x80, 'stm32f10x_usart.o ro_data (.rodata)')
  assert.equal(usartModule.rw_data, 0x20, 'stm32f10x_usart.o rw_data (.data)')
  assert.equal(usartModule.zi_data, 0x40, 'stm32f10x_usart.o zi_data (.bss)')

  const startupModule = parsed.modules.find(m => m.name === 'startup.o')
  assert.ok(startupModule, 'startup.o module should exist')
  assert.equal(startupModule.code, 0x188, 'startup.o code (.isr_vector)')
  assert.equal(startupModule.ro_data, 0, 'startup.o ro_data (none)')
  assert.equal(startupModule.rw_data, 0, 'startup.o rw_data (none)')
  assert.equal(startupModule.zi_data, 0x40, 'startup.o zi_data (.bss)')

  // totals 应该基于 sections 计算（GCC 无 Grand Totals 行时从 sections 汇总）
  const expectedCode = 0x188 + 0x1000 // .isr_vector + .text
  const expectedRo = 0x100 // .rodata
  const expectedRw = 0x40 // .data
  const expectedZi = 0x100 // .bss

  assert.equal(parsed.totals.code, expectedCode)
  assert.equal(parsed.totals.roData, expectedRo)
  assert.equal(parsed.totals.rwData, expectedRw)
  assert.equal(parsed.totals.ziData, expectedZi)
  assert.equal(parsed.totals.flashUsed, expectedCode + expectedRo + expectedRw)
  assert.equal(parsed.totals.ramUsed, expectedRw + expectedZi)
})

test('GCC 带 load address 的 .data 段：loadAddress 正确提取', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.text           0x08000000      0x200
 .text          0x08000000       0x200 main.o

.data           0x20000000       0x100 load address 0x08001000
 .data          0x20000000        0x80 main.o
 .data          0x20000080        0x80 utils.o

.bss            0x20000100       0x200
 .bss           0x20000100       0x200 main.o
`

  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'GCC')

  const dataSection = parsed.sections.find(s => s.name === '.data')
  assert.ok(dataSection, '.data section should exist')
  assert.equal(dataSection.address, 0x20000000, '.data VMA should be in RAM')
  assert.equal(dataSection.size, 0x100, '.data size should be 0x100')
  assert.equal(dataSection.loadAddress, 0x08001000, '.data load address should be in FLASH')

  const textSection = parsed.sections.find(s => s.name === '.text')
  assert.ok(textSection, '.text section should exist')
  assert.equal(textSection.loadAddress, undefined, '.text should not have loadAddress')

  const bssSection = parsed.sections.find(s => s.name === '.bss')
  assert.ok(bssSection, '.bss section should exist')
  assert.equal(bssSection.loadAddress, undefined, '.bss should not have loadAddress')
})

test('GCC memory region used 值从 section 地址推算', () => {
  const content = `
Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00100000         xr
RAM              0x20000000         0x00020000         xrw

Linker script and memory map

.text           0x08000000      0x3000
 .text          0x08000000      0x3000 main.o

.rodata         0x08003000       0x500
 .rodata        0x08003000       0x500 main.o

.data           0x20000000       0x100 load address 0x08003500
 .data          0x20000000       0x100 main.o

.bss            0x20000100       0x800
 .bss           0x20000100       0x800 main.o
`

  const parsed = mapParser.parse(content)

  const flash = parsed.memoryRegions.find(r => r.name === 'FLASH')
  const ram = parsed.memoryRegions.find(r => r.name === 'RAM')

  assert.ok(flash, 'FLASH region should exist')
  assert.ok(ram, 'RAM region should exist')

  // FLASH used: .text(0x3000) + .rodata(0x500) + .data load(0x100 in FLASH range)
  // 但 .data load address 检查: sec.loadAddress >= region.origin && sec.loadAddress < region.origin + region.length
  // .text address 0x08000000 在 FLASH 内 → +0x3000
  // .rodata address 0x08003000 在 FLASH 内 → +0x500
  // .data address 0x20000000 不在 FLASH 内，loadAddress 0x08003500 在 FLASH 内 → +0x100
  // .bss address 0x20000100 不在 FLASH 内 → +0
  assert.equal(flash.used, 0x3000 + 0x500 + 0x100, 'FLASH used should include .text + .rodata + .data load')

  // RAM used: .data(0x100) + .bss(0x800)
  // .data address 0x20000000 在 RAM 内 → +0x100
  // .bss address 0x20000100 在 RAM 内 → +0x800
  assert.equal(ram.used, 0x100 + 0x800, 'RAM used should include .data + .bss')
})

// ============================================================
// Keil 格式补充测试
// ============================================================

test('Keil 多 Execution Region 解析为独立 section', () => {
  const content = `
ARM Linker

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00001000, Max: 0x00010000, ABSOLUTE)

    Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00000C00, Max: 0x00010000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000130   Data   RO            3    RESET               startup.o
    0x08000130   0x08000130   0x00000AD0   Code   RO         1001    i.main              main.o

    Execution Region RW_IRAM1 (Exec base: 0x20000000, Load base: 0x08000C00, Size: 0x00000400, Max: 0x00010000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x20000000   0x08000C00   0x00000100   Data   RW         1002    .data               main.o
    0x20000100        -       0x00000300   Zero   RW         1003    .bss                main.o

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name

       256          0          0          0          0          0   main.o
        64          0        304          0          0          0   startup.o

    ----------------------------------------------------------------------
       320          0        304          0          0          0   Object Totals

    ======================================================================

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug

        320          0        304          0       768          0   Grand Totals

    Total RO  Size (Code + RO Data)                  624 (   0.61kB)
    Total RW  Size (RW Data + ZI Data)               768 (   0.75kB)
    Total ROM Size (Code + RO Data + RW Data)         320 (   0.31kB)
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'Keil')
  assert.equal(parsed.sections.length, 2)

  const erIrom = parsed.sections.find(s => s.name === 'ER_IROM1')
  assert.ok(erIrom, 'ER_IROM1 section should exist')
  assert.equal(erIrom.type, '代码')
  assert.equal(erIrom.attributes, 'RO')
  assert.equal(erIrom.address, 0x08000000)
  assert.equal(erIrom.size, 0x00000C00)

  const rwIram = parsed.sections.find(s => s.name === 'RW_IRAM1')
  assert.ok(rwIram, 'RW_IRAM1 section should exist')
  assert.equal(rwIram.type, '数据')
  assert.equal(rwIram.attributes, 'RW')
  assert.equal(rwIram.address, 0x20000000)
  assert.equal(rwIram.size, 0x00000400)
})

test('Keil 符号类型和作用域识别', () => {
  const content = `
ARM Linker

Global Symbols

Symbol Name                              Value     Ov Type        Size  Object(Section)

main                                    0x08000101   Thumb Code   256  main.o(.text)
counter                                 0x20000000   Data           4  main.o(.bss)
local_func                              0x08000200   Thumb Code    48  utils.o(.text)
my_const                                0x08000300   Number         0  main.o(.rodata)
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.formatType, 'Keil')

  const mainSym = parsed.symbols.find(s => s.name === 'main')
  assert.ok(mainSym, 'main should exist')
  assert.equal(mainSym.type, '函数')
  assert.equal(mainSym.scope, 'Global')
  assert.equal(mainSym.size, 256)

  const counterSym = parsed.symbols.find(s => s.name === 'counter')
  assert.ok(counterSym, 'counter should exist')
  assert.equal(counterSym.type, '变量')

  const constSym = parsed.symbols.find(s => s.name === 'my_const')
  assert.ok(constSym, 'my_const should exist')
  assert.equal(constSym.type, '数据')
})

test('Keil 模块过滤：跳过 Totals/Padding/LibraryName', () => {
  const content = `
ARM Linker

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name

       256          0          0          0          0          0   main.o
       128          0          0          0          0          0   utils.o

    ----------------------------------------------------------------------
       384          0          0          0          0          0   Object Totals
         0          0          2          0          0          0   (incl. Padding)

    ----------------------------------------------------------------------

       512          0          0          0          0          0   printf8.o

    ----------------------------------------------------------------------
       512          0          0          0          0          0   Library Totals

    ----------------------------------------------------------------------

       512          0          0          0          0          0   Library Totals

    ----------------------------------------------------------------------
       896          0          0          0          0          0   Totals

==============================================================================

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug

        896          0          2          0          0          0   Grand Totals

    Total RO  Size (Code + RO Data)                  898 (   0.88kB)
    Total RW  Size (RW Data + ZI Data)                 0 (   0.00kB)
    Total ROM Size (Code + RO Data + RW Data)         898 (   0.88kB)
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.modules.length, 3, 'should have 3 modules: main.o + utils.o + printf8.o')
  assert.ok(parsed.modules.find(m => m.name === 'main.o'), 'main.o should exist')
  assert.ok(parsed.modules.find(m => m.name === 'utils.o'), 'utils.o should exist')
  assert.ok(parsed.modules.find(m => m.name === 'printf8.o'), 'printf8.o should exist')

  // 这些不应出现在 modules 中
  assert.ok(!parsed.modules.find(m => m.name.includes('Totals')), 'no Totals entries')
  assert.ok(!parsed.modules.find(m => m.name.includes('Padding')), 'no Padding entries')
})

test('Keil 空字符串返回默认结构', () => {
  const parsed = mapParser.parse('')

  assert.equal(parsed.formatType, 'GCC')
  assert.equal(parsed.symbols.length, 0)
  assert.equal(parsed.sections.length, 0)
  assert.equal(parsed.modules.length, 0)
  assert.equal(parsed.memoryRegions.length, 0)
  assert.equal(parsed.totals.code, 0)
  assert.equal(parsed.totals.flashUsed, 0)
})

test('Keil 同名 Execution Region 不重复添加', () => {
  const content = `
ARM Linker

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00001000, Max: 0x00010000, ABSOLUTE)

    Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00000C00, Max: 0x00010000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000C00   Code   RO         1001    .text               main.o

    Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00000C00, Max: 0x00010000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000C00   Code   RO         1001    .text               main.o

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name

       256          0          0          0          0          0   main.o

    ======================================================================

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug

        256          0          0          0          0          0   Grand Totals
`
  const parsed = mapParser.parse(content)

  // 同名 ER_IROM1 只应出现一次
  const erIroms = parsed.memoryRegions.filter(r => r.name === 'ER_IROM1')
  assert.equal(erIroms.length, 1, 'ER_IROM1 should appear only once in memoryRegions')
})

test('Keil Execution Region 属性推断', () => {
  const content = `
ARM Linker

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00001000, Max: 0x00010000, ABSOLUTE)

    Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00000C00, Max: 0x00010000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000C00   Code   RO         1001    .text               main.o

    Execution Region RW_IRAM1 (Exec base: 0x20000000, Load base: 0x08000C00, Size: 0x00000400, Max: 0x00010000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x20000000   0x08000C00   0x00000400   Data   RW         1002    .data               main.o

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name

       256          0          0          0          0          0   main.o

    ======================================================================

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug

        256          0          0          0       400          0   Grand Totals
`
  const parsed = mapParser.parse(content)

  const irom = parsed.memoryRegions.find(r => r.name === 'ER_IROM1')
  assert.ok(irom, 'ER_IROM1 should exist')
  assert.equal(irom.attributes, 'rx', 'ER_IROM1 should be rx')

  const iram = parsed.memoryRegions.find(r => r.name === 'RW_IRAM1')
  assert.ok(iram, 'RW_IRAM1 should exist')
  assert.equal(iram.attributes, 'rw', 'RW_IRAM1 should be rw')
})

test('Keil Global Symbols 段的分隔线和表头被正确跳过', () => {
  const content = `
ARM Linker

Global Symbols

Symbol Name                              Value     Ov Type        Size  Object(Section)

main                                    0x08000101   Thumb Code   256  main.o(.text)
init                                    0x08000201   Thumb Code    48  init.o(.text)
`
  const parsed = mapParser.parse(content)

  assert.equal(parsed.symbols.length, 2)
  assert.ok(parsed.symbols.find(s => s.name === 'main'))
  assert.ok(parsed.symbols.find(s => s.name === 'init'))
  // 不应有 "Symbol Name" 作为符号
  assert.ok(!parsed.symbols.find(s => s.name === 'Symbol'), 'header text should not be a symbol')
})
