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
