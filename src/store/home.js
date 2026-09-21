import { defineStore } from 'pinia'

async function api(path, method = 'GET', body) {
  const opt = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opt.body = JSON.stringify(body)
  const r = await fetch('/api' + path, opt)
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || '请求失败')
  return data
}

export const useHomeStore = defineStore('home', {
  state: () => ({
    loaded: false,
    rooms: [],
    types: [],
    devices: [],
    scenes: [],
    logs: [],
    energy: [],
    alerts: [],
    toast: null
  }),
  getters: {
    onlineCount: (s) => s.devices.filter((d) => d.status === 'online').length,
    errorCount: (s) => s.devices.filter((d) => d.status === 'error').length,
    onCount: (s) => s.devices.filter((d) => d.power_on).length,
    totalWatts: (s) => s.devices.reduce((sum, d) => sum + (d.power_on ? d.watts : 0), 0)
  },
  actions: {
    async load() {
      const d = await api('/state')
      this.rooms = d.rooms
      this.types = d.types
      this.devices = d.devices
      this.scenes = d.scenes
      this.logs = d.logs
      this.energy = d.energy
      this.alerts = d.alerts
      this.loaded = true
    },
    toastMsg(msg, type = 'info') {
      this.toast = { msg, type, id: Date.now() }
    },
    clearToast() { this.toast = null },

    async addDevice(p) {
      try { await api('/device', 'POST', p); await this.load(); this.toastMsg('已新增设备', 'success') }
      catch (e) { this.toastMsg(e.message, 'warn') }
    },
    async removeDevice(id) {
      const r = await api('/device/' + id, 'DELETE'); await this.load()
      if (r.affected_actions) this.toastMsg(`设备已删除，${r.affected_actions} 个场景动作已失效`, 'warn')
    },
    async toggleDevice(id) {
      const r = await api(`/device/${id}/toggle`, 'POST'); await this.load()
      return r.power_on
    },
    async updateDevice(id, patch) {
      try { await api(`/device/${id}/update`, 'POST', patch); await this.load() }
      catch (e) { this.toastMsg(e.message, 'warn') }
    },
    async addScene(scene) {
      const r = await api('/scene', 'POST', scene); await this.load(); this.toastMsg('场景已创建', 'success'); return r.id
    },
    async deleteScene(id) {
      await api('/scene/' + id, 'DELETE'); await this.load()
    },
    async toggleScene(id) {
      await api(`/scene/${id}/toggle`, 'POST'); await this.load()
    },
    async runScene(id) {
      const r = await api(`/scene/${id}/run`, 'POST'); await this.load()
      const okN = r.executed?.length || 0
      const failN = r.failed?.length || 0
      if (failN) {
        const reasons = r.failed.map((f) => `${f.device}：${f.reason}`).join('；')
        this.toastMsg(`场景执行完成：${okN} 成功 / ${failN} 失败（${reasons}）`, 'warn')
      } else if (okN) {
        this.toastMsg(`场景已触发，${okN} 个动作全部执行成功`, 'success')
      } else {
        this.toastMsg('场景没有可执行的动作', 'info')
      }
      return r
    }
  }
})