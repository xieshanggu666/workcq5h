import express from 'express'
import { db } from './db.js'

const app = express()
app.use(express.json())

const q = (sql, ...p) => db.prepare(sql).all(...p)
const q1 = (sql, ...p) => db.prepare(sql).get(...p)
const run = (sql, ...p) => db.prepare(sql).run(...p)
const now = () => new Date().toLocaleString('zh-CN')

// 追加日志
function log(device, action, detail = '') {
  run('INSERT INTO device_logs (device_name,action,detail,time) VALUES (?,?,?,?)', device, action, detail, now())
  // 保留最近 200 条
  const c = q1('SELECT COUNT(*) c FROM device_logs').c
  if (c > 200) db.exec('DELETE FROM device_logs WHERE id <= (SELECT MAX(id)-200 FROM device_logs)')
}

// ===== 状态聚合 =====
app.get('/api/state', (req, res) => {
  res.json({
    rooms: q('SELECT * FROM rooms'),
    types: q('SELECT * FROM device_types'),
    devices: q(`SELECT d.*, r.name room, t.name type_name, t.icon type_icon
                FROM devices d JOIN rooms r ON r.id=d.room_id JOIN device_types t ON t.id=d.type_id`),
    scenes: q(`SELECT s.*, GROUP_CONCAT(sa.device_key||'|'||sa.action,';') actions, COUNT(sa.id) action_count
               FROM scenes s LEFT JOIN scene_actions sa ON sa.scene_id=s.id GROUP BY s.id`),
    logs: q('SELECT * FROM device_logs ORDER BY id DESC LIMIT 50'),
    energy: q('SELECT * FROM energy'),
    alerts: computeAlerts()
  })
})

function computeAlerts() {
  const devs = q('SELECT * FROM devices')
  const alerts = []
  for (const d of devs) {
    if (d.status === 'error') alerts.push({ device: d.name, level: 'error', text: '设备离线/异常' })
    else if (d.battery < 40) alerts.push({ device: d.name, level: 'warn', text: `电量低(${d.battery}%)` })
    else if (d.signal < 60) alerts.push({ device: d.name, level: 'warn', text: `信号弱(${d.signal})` })
  }
  // 能耗异常：某设备 24h 峰值异常偏离
  const agg = q(`SELECT device_name, MAX(kwh) peak, AVG(kwh) avg FROM energy GROUP BY device_name`)
  for (const row of agg) {
    if (row.avg > 0 && row.peak > row.avg * 3) {
      alerts.push({ device: row.device_name, level: 'info', text: '能耗尖峰偏离平均值' })
    }
  }
  return alerts
}

// ===== 设备 =====
app.post('/api/device', (req, res) => {
  const { name, type_id, room_id } = req.body
  if (!name || !type_id || !room_id) return res.status(400).json({ error: 'missing' })
  const r = run('INSERT INTO devices (name,type_id,room_id) VALUES (?,?,?)', name, type_id, room_id)
  log(name, '新增设备', `房间 ${q1('SELECT name FROM rooms WHERE id=?', room_id).name}`)
  res.json({ ok: true, id: r.lastInsertRowid })
})
app.delete('/api/device/:id', (req, res) => {
  const d = q1('SELECT * FROM devices WHERE id=?', req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  run('DELETE FROM devices WHERE id=?', d.id)
  log(d.name, '删除设备')
  res.json({ ok: true })
})
// 切换开关
app.post('/api/device/:id/toggle', (req, res) => {
  const d = q1('SELECT * FROM devices WHERE id=?', req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  const on = d.power_on ? 0 : 1
  run('UPDATE devices SET power_on=? WHERE id=?', on, d.id)
  log(d.name, on ? '开启' : '关闭')
  res.json({ ok: true, power_on: on })
})
// 更新设备字段
app.post('/api/device/:id/update', (req, res) => {
  const d = q1('SELECT * FROM devices WHERE id=?', req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  const { name, room_id, watts, power_on } = req.body
  run('UPDATE devices SET name=?, room_id=?, watts=?, power_on=? WHERE id=?',
    name ?? d.name, room_id ?? d.room_id, watts ?? d.watts, power_on ?? d.power_on, d.id)
  log(name ?? d.name, '更新设备')
  res.json({ ok: true })
})

// ===== 场景 =====
app.post('/api/scene', (req, res) => {
  const { name, actions } = req.body
  const r = run('INSERT INTO scenes (name,desc,enabled) VALUES (?,?,1)', name || '新场景', '')
  const act = db.prepare('INSERT INTO scene_actions (scene_id,device_key,action,order_no) VALUES (?,?,?,?)')
  ;(actions || []).forEach((a, i) => act.run(r.lastInsertRowid, a.device, a.action, i))
  res.json({ ok: true, id: r.lastInsertRowid })
})
app.delete('/api/scene/:id', (req, res) => {
  const s = q1('SELECT * FROM scenes WHERE id=?', req.params.id)
  if (s) { run('DELETE FROM scenes WHERE id=?', s.id); run('DELETE FROM scene_actions WHERE scene_id=?', s.id) }
  res.json({ ok: true })
})
app.post('/api/scene/:id/toggle', (req, res) => {
  const s = q1('SELECT * FROM scenes WHERE id=?', req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  run('UPDATE scenes SET enabled=? WHERE id=?', s.enabled ? 0 : 1, s.id)
  res.json({ ok: true, enabled: s.enabled ? 0 : 1 })
})
// 触发场景：执行动作写入日志（演示模拟）
app.post('/api/scene/:id/run', (req, res) => {
  const s = q1('SELECT * FROM scenes WHERE id=?', req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  const actions = q('SELECT * FROM scene_actions WHERE scene_id=? ORDER BY order_no', s.id)
  if (!actions.length) return res.json({ ok: true, executed: [] })
  // 模拟执行：找到匹配设备并切换动作（开启/关闭）
  const executed = []
  for (const a of actions) {
    const dev = q1('SELECT * FROM devices WHERE name=?', a.device_key)
    if (dev) {
      if (a.action.includes('关')) run('UPDATE devices SET power_on=0 WHERE id=?', dev.id)
      else if (a.action.includes('开')) run('UPDATE devices SET power_on=1 WHERE id=?', dev.id)
      log(dev.name, `场景「${s.name}」执行`, a.action)
      executed.push({ device: dev.name, action: a.action })
    } else {
      log(a.device_key, `场景「${s.name}」执行`, a.action + '（动作记录）')
      executed.push({ device: a.device_key, action: a.action })
    }
  }
  res.json({ ok: true, executed })
})

// ===== 日志 =====
app.get('/api/logs', (req, res) => {
  res.json(q('SELECT * FROM device_logs ORDER BY id DESC LIMIT 100'))
})

const PORT = 4120
app.listen(PORT, () => console.log(`[HOME] API running at http://localhost:${PORT}`))