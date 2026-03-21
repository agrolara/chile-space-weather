import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, 'data')
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

async function fetchSismos() {
  try {
    // USGS: últimos 2 días (48h), magnitud ≥ 4.4, Chile
    const startTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&minlatitude=-55&maxlatitude=-17&minlongitude=-80&maxlongitude=-66&minmagnitude=4.4&orderby=time-asc&limit=50`
    const res = await axios.get(url)
    const features = res.data.features || []
    const sismos = features.map(f => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      url: f.properties.url,
    }))
    // Opcional: también agregar el último de boostr.cl si es más reciente? (por ahora solo USGS)
    return sismos
  } catch (err) {
    console.error('Error fetching USGS:', err.message)
    return []
  }
}

async function fetchSpaceWeather() {
  try {
    const kpRes = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json')
    const kpData = kpRes.data || []
    const rows = kpData.slice(1)
    const last24 = rows.slice(-8).reverse()
    const kpHistory = last24.map(d => ({
      time: d[0],
      kp: parseFloat(d[1]) || 0,
    }))
    const latest = kpHistory[kpHistory.length - 1] || { kp: 0, time: new Date().toISOString() }
    let grade = 'G0'
    if (latest.kp >= 7) grade = 'G5'
    else if (latest.kp >= 6) grade = 'G4'
    else if (latest.kp >= 5) grade = 'G3'
    else if (latest.kp >= 4) grade = 'G2'
    else if (latest.kp >= 3) grade = 'G1'
    let alert = null
    if (grade === 'G5' || grade === 'G4' || grade === 'G3') {
      alert = `Tormenta solar moderada a severa (KP ${latest.kp})`
    }
    return {
      kpIndex: latest.kp,
      grade,
      alert,
      updated: latest.time,
      kpHistory,
    }
  } catch (err) {
    console.error('Error fetching NOAA:', err.message)
    return {
      kpIndex: 0,
      grade: 'G0',
      alert: null,
      updated: new Date().toISOString(),
      kpHistory: [],
    }
  }
}

async function fetchVolcanes() {
  try {
    return [
      { nombre: 'Villarrica', lat: -39.292, lng: -71.974, alerta: 'Amarillo', ultima: '2026-03-15' },
      { nombre: 'Calbuco', lat: -41.33, lng: -72.62, alerta: 'Verde', ultima: '2025-12-10' },
      { nombre: 'Llaima', lat: -38.75, lng: -71.25, alerta: 'Amarillo', ultima: '2026-03-12' },
      { nombre: 'Chaitén', lat: -42.83, lng: -72.65, alerta: 'Verde', ultima: '2025-06-20' },
      { nombre: 'Copahue', lat: -37.85, lng: -71.15, alerta: 'Amarillo', ultima: '2026-03-05' },
    ]
  } catch (err) {
    console.error('Error fetching volcanes:', err.message)
    return []
  }
}

async function fetchClimaSantiago() {
  try {
    const latitude = -33.4489
    const longitude = -70.6693
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relativehumidity_2m,uv_index,visibility&timezone=America%2FSantiago&wind_speed_unit=kmh`
    const res = await axios.get(url)
    const cw = res.data.current_weather
    const hourly = res.data.hourly || {}
    const getLast = (arr) => (arr && arr.length ? arr[arr.length - 1] : null)
    const humidity = getLast(hourly.relativehumidity_2m)
    const uv = getLast(hourly.uv_index)
    const visibility = getLast(hourly.visibility)
    return {
      temp_c: cw.temperature,
      wind_kph: cw.windspeed,
      wind_dir: cw.winddirection,
      code: cw.weathercode,
      humidity,
      uv,
      visibility: visibility ? (visibility / 1000) : null,
      updated: new Date().toISOString(),
    }
  } catch (err) {
    console.error('Error fetching Open-Meteo:', err.message)
    return null
  }
}

function writeJSON(file, data) {
  const filePath = path.join(DATA_DIR, file)
  const content = JSON.stringify(data, null, 2)
  fs.writeFileSync(filePath, content, 'utf-8')
}

async function gitSetup() {
  try {
    await execAsync('git config user.name "OpenClaw"')
    await execAsync('git config user.email "openclaw@localhost"')
  } catch (e) {}
}

async function gitCommitAndPush() {
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  GITHUB_TOKEN no configurado. Omitiendo git push.')
    return
  }
  try {
    await gitSetup()
    process.chdir(__dirname)
    await execAsync('git add data/*.json')
    await execAsync(`git commit -m "Update data ${new Date().toISOString()}"`)
    await execAsync('git push origin main')
    console.log('✅ Data pushed to GitHub')
  } catch (err) {
    console.error('Git error:', err)
  }
}

async function main() {
  console.log('🔄 Iniciando poll de datos...')
  const [sismos, sw, volcanes, clima] = await Promise.all([
    fetchSismos(),
    fetchSpaceWeather(),
    fetchVolcanes(),
    fetchClimaSantiago(),
  ])
  writeJSON('sismos.json', { sismos, generated: new Date().toISOString() })
  writeJSON('space-weather.json', { ...sw, generated: new Date().toISOString() })
  writeJSON('volcanes.json', { volcanes, generated: new Date().toISOString() })
  if (clima) {
    writeJSON('clima_santiago.json', clima)
  }
  console.log(`✅ Datos actualizados: ${sismos.length} sismos, ${volcanes.length} volcanes, KP=${sw.kpIndex} (${sw.grade}), clima=${clima ? 'OK' : 'fail'}`)
  await gitCommitAndPush()
}

main().catch(console.error)
