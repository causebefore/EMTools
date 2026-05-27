<script setup>
import { ref, computed } from 'vue'

const asciiSearch = ref('')
const ctrlChars = {
  0: 'NUL (空)', 1: 'SOH', 2: 'STX', 3: 'ETX', 4: 'EOT', 5: 'ENQ', 6: 'ACK', 7: 'BEL',
  8: 'BS', 9: 'HT (Tab)', 10: 'LF (换行)', 11: 'VT', 12: 'FF', 13: 'CR (回车)',
  14: 'SO', 15: 'SI', 16: 'DLE', 17: 'DC1', 18: 'DC2', 19: 'DC3', 20: 'DC4',
  21: 'NAK', 22: 'SYN', 23: 'ETB', 24: 'CAN', 25: 'EM', 26: 'SUB', 27: 'ESC',
  28: 'FS', 29: 'GS', 30: 'RS', 31: 'US', 32: '空格', 127: 'DEL'
}
const asciiData = Array.from({ length: 128 }, (_, i) => ({
  dec: i,
  hex: '0x' + i.toString(16).toUpperCase().padStart(2, '0'),
  oct: i.toString(8).padStart(3, '0'),
  bin: i.toString(2).padStart(8, '0'),
  char: (ctrlChars[i] != null || i >= 127) ? '' : String.fromCharCode(i),
  desc: ctrlChars[i] || ''
}))
const filteredAscii = computed(() => {
  const q = asciiSearch.value.toLowerCase()
  if (!q) return asciiData
  return asciiData.filter(d =>
    String(d.dec).includes(q) || d.hex.toLowerCase().includes(q) ||
    d.oct.includes(q) || d.bin.includes(q) ||
    d.char.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q)
  )
})
</script>

<template>
  <div class="card">
    <p class="tab-desc">标准 ASCII 码表（0-127），支持按字符、十进制、十六进制搜索。</p>
    <div class="form-row" style="margin-bottom:12px">
      <label>搜索:</label>
      <input v-model="asciiSearch" placeholder="输入字符、十进制、十六进制..." style="flex:1;max-width:280px" />
      <span class="mono" style="color:var(--text-muted)">{{ filteredAscii.length }} / 128</span>
    </div>
    <div style="max-height:58vh;overflow-y:auto">
      <table class="data-table">
        <thead>
          <tr><th>Dec</th><th>Hex</th><th>Oct</th><th>Bin</th><th>字符</th><th>描述</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in filteredAscii" :key="d.dec">
            <td class="mono">{{ d.dec }}</td>
            <td class="mono">{{ d.hex }}</td>
            <td class="mono">{{ d.oct }}</td>
            <td class="mono">{{ d.bin }}</td>
            <td class="mono" style="text-align:center">{{ d.char }}</td>
            <td>{{ d.desc }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
