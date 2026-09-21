<template>
  <div class="dash">
    <!-- 顶部统计 -->
    <div class="stat-grid">
      <div class="stat-card"><span class="icon">📟</span><div><b>{{ store.devices.length }}</b><em>全部设备</em></div></div>
      <div class="stat-card green"><span class="icon">🟢</span><div><b>{{ store.onlineCount }}</b><em>在线</em></div></div>
      <div class="stat-card red"><span class="icon">🔴</span><div><b>{{ store.errorCount }}</b><em>异常</em></div></div>
      <div class="stat-card amber"><span class="icon">⚡</span><div><b>{{ onCount }}<em>开启中</em></b><em class="small">{{ (store.totalWatts/1000).toFixed(1) }} kW</em></div></div>
      <div class="stat-card blue"><span class="icon">🔔</span><div><b>{{ store.alerts.length }}</b><em>活跃告警</em></div></div>
    </div>

    <div class="dash-grid">
      <!-- 房间设备分布 -->
      <div class="card">
        <h4>🏠 房间设备分布</h4>
        <div class="room-bar" v-for="r in roomStats" :key="r.name">
          <span class="r-label">{{ r.name }}</span>
          <div class="r-track"><i :style="{width: pct(r) + '%', background: r.onbar}"></i></div>
          <span class="r-num">{{ r.total }}</span>
        </div>
      </div>

      <!-- 设备类型概览 -->
      <div class="card">
        <h4>🧩 设备类型</h4>
        <div class="type-list">
          <div v-for="t in typeStats" :key="t.name" class="type-item">
            <span class="t-icon">{{ t.icon }}</span>
            <span class="t-name">{{ t.name }}</span>
            <span class="t-num">{{ t.count }}台</span>
          </div>
        </div>
      </div>

      <!-- 告警列表 -->
      <div class="card">
        <h4>🚨 告警中心</h4>
        <div v-if="!store.alerts.length" class="none">✨ 无告警，一切正常</div>
        <div v-for="(a,i) in store.alerts" :key="i" class="alert" :class="a.level">
          <span class="a-ic">{{ a.level==='error'?'🔴':a.level==='warn'?'🟠':'🔵' }}</span>
          <div class="a-info"><b>{{ a.device }}</b><span>{{ a.text }}</span></div>
        </div>
      </div>

      <!-- 能耗趋势 24h -->
      <div class="card wide">
        <h4>⚡ 全屋能耗（近24小时 kW·h）</h4>
        <div class="energy-chart">
          <div v-for="(c,idx) in chartData" :key="idx" class="bar" :title="c.hour + '时 '+' '+c.v+'kWh'">
            <i :style="{height: c.pct + '%', background: c.color}"></i>
            <span v-if="idx%3===0" class="xl">{{ c.hour }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useHomeStore } from '@/store/home'
const store = useHomeStore()
const onCount = computed(() => store.onCount)

const roomStats = computed(() => {
  const m = {}
  store.rooms.forEach((r) => { m[r.name] = { total: 0, on: 0 } })
  store.devices.forEach((d) => {
    if (!m[d.room]) m[d.room] = { total: 0, on: 0 }
    m[d.room].total++
    if (d.power_on || d.status === 'error') m[d.room].on++
  })
  return store.rooms.map((r) => {
    const s = m[r.name] || { total: 0, on: 0 }
    return { name: r.name, total: s.total, on: s.on, onbar: s.total ? `hsl(${120*(s.on/s.total)},70%,45%)` : '#333' }
  })
})
function pct(r) { const max = Math.max(...roomStats.value.map((x) => x.total), 1); return Math.round((r.total / max) * 100) }

const typeStats = computed(() => {
  return store.types.map((t) => ({ ...t, count: store.devices.filter((d) => d.type_id === t.id).length }))
})

const chartData = computed(() => {
  const byHour = {}
  store.energy.forEach((e) => { byHour[e.hour] = (byHour[e.hour] || 0) + e.kwh })
  const arr = []
  for (let h = 0; h < 12; h++) {
    const hourKey = ((new Date().getHours() - 11 + h + 24) % 24)
    arr.push({ hour: hourKey, v: byHour[hourKey] || 0 })
  }
  const max = Math.max(...arr.map((a) => a.v), 0.001)
  return arr.map((a) => ({ ...a, pct: Math.max(6, Math.round((a.v / max) * 100)), color: a.v > max * 0.7 ? '#ff7043' : '#42a5f5' }))
})
</script>

<style scoped>
.dash{display:flex;flex-direction:column;gap:16px;}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;}
.stat-card{background:#0f1b38;border:1px solid rgba(120,160,220,0.16);border-radius:12px;padding:14px;display:flex;gap:12px;align-items:center;}
.stat-card .icon{font-size:24px;}
.stat-card b{font-size:24px;color:#fff;display:block;line-height:1;}
.stat-card em{font-size:11px;color:#8ba2c8;font-style:normal;}
.stat-card em.small{color:#ffd54f;}
.stat-card.red b{color:#ef5350;}.stat-card.green b{color:#66bb6a;}.stat-card.amber b{color:#ffb300;}.stat-card.blue b{color:#42a5f5;}
.dash-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
@media(max-width:860px){.dash-grid{grid-template-columns:1fr;}}
.card{background:#0f1b38;border:1px solid rgba(120,160,220,0.16);border-radius:12px;padding:16px;}
.card.wide{grid-column:1/-1;}
h4{margin:0 0 12px;color:#fff;font-size:14px;}
.room-bar{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;}
.r-label{width:46px;color:#8ba2c8;}
.r-track{flex:1;height:10px;background:#0c1730;border-radius:5px;overflow:hidden;}
.r-track i{display:block;height:100%;}
.r-num{width:20px;color:#dbe4f3;text-align:right;}
.type-list{display:flex;flex-wrap:wrap;gap:8px;}
.type-item{background:#16263f;border:1px solid rgba(120,160,220,0.12);border-radius:9px;padding:8px 12px;display:flex;gap:8px;align-items:center;font-size:12px;color:#dbe4f3;flex:1;min-width:120px;}
.t-icon{font-size:18px;}.t-num{color:#ffd54f;margin-left:auto;}
.none{color:#5b6f94;text-align:center;padding:14px;font-size:12px;}
.alert{display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(120,160,220,0.1);}
.alert:last-child{border-bottom:none;}
.a-info b{display:block;color:#dbe4f3;font-size:13px;}
.a-info span{font-size:11px;color:#8ba2c8;}
.alert.error b{color:#ef5350;}.alert.warn b{color:#ffb300;}
.energy-chart{display:flex;align-items:flex-end;gap:4px;height:160px;padding-top:10px;}
.bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;}
.bar i{width:70%;border-radius:4px 4px 0 0;min-height:4px;transition:height .3s;}
.xl{font-size:9px;color:#5b6f94;margin-top:4px;}
</style>