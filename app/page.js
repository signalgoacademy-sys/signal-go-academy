'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDayKey(dateValue) {
  const d = new Date(dateValue)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateTime(dateValue) {
  return new Date(dateValue).toLocaleString()
}

function buildMonthGrid(currentMonthDate) {
  const year = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startWeekDay = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const cells = []

  for (let i = 0; i < startWeekDay; i++) cells.push(null)
  for (let day = 1; day <= totalDays; day++) cells.push(new Date(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

async function getLogoDataUrl() {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = '/logo.png'
  })
}

function SectionHeader({ title, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="mb-4 flex w-full items-center justify-between rounded-2xl border border-yellow-500/20 bg-slate-950 px-4 py-3 text-left"
    >
      <span className="text-lg font-bold">{title}</span>
      <span className="text-yellow-400">{open ? 'Ocultar' : 'Mostrar'}</span>
    </button>
  )
}

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)

  const [profileName, setProfileName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const [editingTradeId, setEditingTradeId] = useState(null)
  const [side, setSide] = useState('buy')
  const [profit, setProfit] = useState('')
  const [pips, setPips] = useState('')
  const [note, setNote] = useState('')
  const [setupType, setSetupType] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [sessionName, setSessionName] = useState('London')

  const [trades, setTrades] = useState([])

  const [accountSize, setAccountSize] = useState('')
  const [dailyLossLimit, setDailyLossLimit] = useState('')
  const [dailyProfitTarget, setDailyProfitTarget] = useState('')
  const [riskPerTrade, setRiskPerTrade] = useState('')
  const [maxTradesPerDay, setMaxTradesPerDay] = useState('')

  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')

  const [statsFrom, setStatsFrom] = useState('')
  const [statsTo, setStatsTo] = useState('')

  const [openTrade, setOpenTrade] = useState(false)
  const [openRisk, setOpenRisk] = useState(false)
  const [openHistory, setOpenHistory] = useState(false)
  const [openChart, setOpenChart] = useState(false)
  const [openCalendar, setOpenCalendar] = useState(false)
  const [openReport, setOpenReport] = useState(false)
  const [openProfile, setOpenProfile] = useState(false)
  const [openPsychology, setOpenPsychology] = useState(false)

  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('')

  const [psychoNotes, setPsychoNotes] = useState([])
  const [editingPsychoId, setEditingPsychoId] = useState(null)
  const [psychoDate, setPsychoDate] = useState('')
  const [psychoTitle, setPsychoTitle] = useState('')
  const [psychoContent, setPsychoContent] = useState('')

  useEffect(() => {
    checkUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadTrades()
      loadRiskSettings()
      loadProfile()
      loadPsychoNotes()
    }
  }, [user])

  async function checkUser() {
    const { data } = await supabase.auth.getUser()
    setUser(data.user ?? null)
  }

  async function signUp() {
    setMessage('')
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : 'Cuenta creada correctamente')
  }

  async function signIn() {
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Login correcto')
      checkUser()
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setMessage('Sesión cerrada')
  }

  async function loadProfile() {
    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user
    if (!currentUser) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle()

    if (!error && data) {
      setProfileName(data.full_name || '')
      setAvatarUrl(data.avatar_url || '')
    } else {
      setProfileName(currentUser.email?.split('@')[0] || '')
      setAvatarUrl('')
    }
  }

  async function uploadAvatarToStorage(currentUser) {
    if (!avatarFile) return avatarUrl

    const fileExt = avatarFile.name.split('.').pop()
    const safeExt = fileExt ? fileExt.toLowerCase() : 'png'
    const fileName = `${currentUser.id}-${Date.now()}.${safeExt}`
    const filePath = `profiles/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, {
        upsert: true,
      })

    if (uploadError) {
      throw uploadError
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath)

    return publicData.publicUrl
  }

  async function saveProfile() {
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user
    if (!currentUser) return

    try {
      setUploadingAvatar(true)

      let finalAvatarUrl = avatarUrl

      if (avatarFile) {
        finalAvatarUrl = await uploadAvatarToStorage(currentUser)
      }

      const { error } = await supabase.from('profiles').upsert({
        id: currentUser.id,
        email: currentUser.email,
        full_name: profileName,
        avatar_url: finalAvatarUrl,
      })

      if (error) {
        setMessage(error.message)
      } else {
        setAvatarUrl(finalAvatarUrl || '')
        setAvatarFile(null)
        setMessage('Perfil guardado correctamente')
      }
    } catch (error) {
      setMessage(
        error?.message ||
          'No se pudo subir la foto. Revisa que exista el bucket público llamado avatars en Supabase.'
      )
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function updatePassword() {
    setMessage('')

    if (!newPassword) {
      setMessage('Escribe una nueva contraseña')
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Contraseña actualizada correctamente')
      setNewPassword('')
    }
  }

  async function loadTrades() {
    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user
    if (!currentUser) return

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('trade_date', { ascending: false })

    if (!error) {
      setTrades(data || [])
    }
  }

  function resetTradeForm() {
    setEditingTradeId(null)
    setSide('buy')
    setProfit('')
    setPips('')
    setNote('')
    setSetupType('')
    setConfirmation('')
    setSessionName('London')
  }

  async function saveTrade() {
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user

    if (!currentUser) {
      setMessage('Debes iniciar sesión primero')
      return
    }

    if (profit === '' || pips === '') {
      setMessage('Completa profit y pips')
      return
    }

    const payload = {
      user_id: currentUser.id,
      trade_date: new Date().toISOString(),
      side,
      symbol: 'XAUUSD',
      profit_usd: Number(profit || 0),
      pips: Number(pips || 0),
      note,
      setup_type: setupType,
      confirmation,
      session: sessionName,
    }

    let error = null

    if (editingTradeId) {
      const response = await supabase
        .from('trades')
        .update({
          side: payload.side,
          profit_usd: payload.profit_usd,
          pips: payload.pips,
          note: payload.note,
          setup_type: payload.setup_type,
          confirmation: payload.confirmation,
          session: payload.session,
        })
        .eq('id', editingTradeId)

      error = response.error
    } else {
      const response = await supabase.from('trades').insert([payload])
      error = response.error
    }

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(editingTradeId ? 'Trade editado correctamente' : 'Trade guardado correctamente')
      resetTradeForm()
      loadTrades()
    }
  }

  function startEditTrade(trade) {
    setEditingTradeId(trade.id)
    setSide(trade.side || 'buy')
    setProfit(String(trade.profit_usd ?? ''))
    setPips(String(trade.pips ?? ''))
    setNote(trade.note || '')
    setSetupType(trade.setup_type || '')
    setConfirmation(trade.confirmation || '')
    setSessionName(trade.session || 'London')
    setOpenTrade(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteTrade(id) {
    const confirmDelete = window.confirm('¿Seguro que quieres eliminar este trade?')
    if (!confirmDelete) return

    setMessage('')
    const { error } = await supabase.from('trades').delete().eq('id', id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Trade eliminado correctamente')
      loadTrades()
    }
  }

  async function loadRiskSettings() {
    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user
    if (!currentUser) return

    const { data, error } = await supabase
      .from('risk_settings')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (!error && data) {
      setAccountSize(data.account_size?.toString() || '')
      setDailyLossLimit(data.daily_loss_limit?.toString() || '')
      setDailyProfitTarget(data.daily_profit_target?.toString() || '')
      setRiskPerTrade(data.risk_per_trade?.toString() || '')
      setMaxTradesPerDay(data.max_trades_per_day?.toString() || '')
    }
  }

  async function saveRiskSettings() {
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user

    if (!currentUser) {
      setMessage('Debes iniciar sesión primero')
      return
    }

    const { error } = await supabase.from('risk_settings').upsert({
      user_id: currentUser.id,
      account_size: Number(accountSize || 0),
      daily_loss_limit: Number(dailyLossLimit || 0),
      daily_profit_target: Number(dailyProfitTarget || 0),
      risk_per_trade: Number(riskPerTrade || 0),
      max_trades_per_day: Number(maxTradesPerDay || 0),
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Gestión de riesgo guardada correctamente')
    }
  }

  async function loadPsychoNotes() {
    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user
    if (!currentUser) return

    const { data, error } = await supabase
      .from('psycho_notes')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('note_date', { ascending: false })

    if (!error) {
      setPsychoNotes(data || [])
    }
  }

  function resetPsychoForm() {
    setEditingPsychoId(null)
    setPsychoDate('')
    setPsychoTitle('')
    setPsychoContent('')
  }

  async function savePsychoNote() {
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user

    if (!currentUser) {
      setMessage('Debes iniciar sesión primero')
      return
    }

    if (!psychoDate || !psychoContent) {
      setMessage('Debes elegir fecha y escribir tu nota emocional')
      return
    }

    let error = null

    if (editingPsychoId) {
      const response = await supabase
        .from('psycho_notes')
        .update({
          note_date: psychoDate,
          title: psychoTitle,
          content: psychoContent,
        })
        .eq('id', editingPsychoId)

      error = response.error
    } else {
      const response = await supabase.from('psycho_notes').insert([
        {
          user_id: currentUser.id,
          note_date: psychoDate,
          title: psychoTitle,
          content: psychoContent,
        },
      ])

      error = response.error
    }

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(
        editingPsychoId
          ? 'Nota emocional editada correctamente'
          : 'Nota emocional guardada correctamente'
      )
      resetPsychoForm()
      loadPsychoNotes()
    }
  }

  function startEditPsychoNote(note) {
    setEditingPsychoId(note.id)
    setPsychoDate(note.note_date || '')
    setPsychoTitle(note.title || '')
    setPsychoContent(note.content || '')
    setOpenPsychology(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deletePsychoNote(id) {
    const confirmDelete = window.confirm('¿Seguro que quieres eliminar esta nota emocional?')
    if (!confirmDelete) return

    const { error } = await supabase.from('psycho_notes').delete().eq('id', id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Nota emocional eliminada correctamente')
      loadPsychoNotes()
    }
  }

  const filteredTradesForStats = useMemo(() => {
    return trades.filter((trade) => {
      const tradeDay = formatDayKey(trade.trade_date)
      if (statsFrom && tradeDay < statsFrom) return false
      if (statsTo && tradeDay > statsTo) return false
      return true
    })
  }, [trades, statsFrom, statsTo])

  const totalProfit = useMemo(() => {
    return filteredTradesForStats.reduce((sum, trade) => sum + Number(trade.profit_usd || 0), 0)
  }, [filteredTradesForStats])

  const totalTrades = filteredTradesForStats.length

  const winningTrades = useMemo(() => {
    return filteredTradesForStats.filter((trade) => Number(trade.profit_usd) > 0).length
  }, [filteredTradesForStats])

  const losingTrades = useMemo(() => {
    return filteredTradesForStats.filter((trade) => Number(trade.profit_usd) < 0).length
  }, [filteredTradesForStats])

  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0'

  const pnlByDay = useMemo(() => {
    const map = {}
    for (const trade of trades) {
      const key = formatDayKey(trade.trade_date)
      map[key] = (map[key] || 0) + Number(trade.profit_usd || 0)
    }
    return map
  }, [trades])

  const todayKey = formatDayKey(new Date())
  const todayPnl = pnlByDay[todayKey] || 0
  const todayTradesCount = trades.filter((trade) => formatDayKey(trade.trade_date) === todayKey).length

  const riskAlert = useMemo(() => {
    const lossLimit = Number(dailyLossLimit || 0)
    const profitTarget = Number(dailyProfitTarget || 0)
    const maxTrades = Number(maxTradesPerDay || 0)

    if (profitTarget > 0 && todayPnl >= profitTarget) {
      return 'Llegaste al profit diario, recomiendo no operar más por esta sesión.'
    }

    if (lossLimit > 0 && todayPnl <= -lossLimit) {
      return 'Llegaste al límite de pérdida diaria, no sigas operando, respeta tu plan. Mañana será un mejor día, relájate.'
    }

    if (maxTrades > 0 && todayTradesCount >= maxTrades) {
      return `Máximo de trades diarios alcanzado: ${todayTradesCount}`
    }

    return ''
  }, [dailyLossLimit, dailyProfitTarget, maxTradesPerDay, todayPnl, todayTradesCount])

  const chartData = useMemo(() => {
    const ordered = [...filteredTradesForStats].sort(
      (a, b) => new Date(a.trade_date) - new Date(b.trade_date)
    )
    let running = 0

    return ordered.map((trade, index) => {
      running += Number(trade.profit_usd || 0)
      return {
        name: index + 1,
        balance: running,
      }
    })
  }, [filteredTradesForStats])

  const monthCells = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth])

  const displayedTrades = useMemo(() => {
    if (!selectedCalendarDate) return trades
    return trades.filter((trade) => formatDayKey(trade.trade_date) === selectedCalendarDate)
  }, [trades, selectedCalendarDate])

  const reportFilteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const tradeDay = formatDayKey(trade.trade_date)
      if (reportFrom && tradeDay < reportFrom) return false
      if (reportTo && tradeDay > reportTo) return false
      return true
    })
  }, [trades, reportFrom, reportTo])

  const reportProfit = reportFilteredTrades.reduce(
    (sum, trade) => sum + Number(trade.profit_usd || 0),
    0
  )

  const reportPipsNet = reportFilteredTrades.reduce((sum, trade) => sum + Number(trade.pips || 0), 0)

  const reportPipsWon = reportFilteredTrades
    .filter((trade) => Number(trade.pips || 0) > 0)
    .reduce((sum, trade) => sum + Number(trade.pips || 0), 0)

  const reportPipsLost = reportFilteredTrades
    .filter((trade) => Number(trade.pips || 0) < 0)
    .reduce((sum, trade) => sum + Number(trade.pips || 0), 0)

  const reportWinningTrades = reportFilteredTrades.filter(
    (trade) => Number(trade.profit_usd || 0) > 0
  ).length

  const reportWinRate =
    reportFilteredTrades.length > 0
      ? ((reportWinningTrades / reportFilteredTrades.length) * 100).toFixed(1)
      : '0.0'

  function goPrevMonth() {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
  }

  function goNextMonth() {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
  }

  function handleCalendarDayClick(cell) {
    const key = formatDayKey(cell)
    setSelectedCalendarDate(key)
    setOpenHistory(true)
  }

  function clearCalendarFilter() {
    setSelectedCalendarDate('')
  }

  function clearStatsFilter() {
    setStatsFrom('')
    setStatsTo('')
  }

  async function downloadPDF() {
    if (reportFilteredTrades.length === 0) {
      setMessage('No hay trades en ese rango de fechas para generar el PDF')
      return
    }

    const doc = new jsPDF()

    try {
      const logoDataUrl = await getLogoDataUrl()
      doc.addImage(logoDataUrl, 'PNG', 14, 10, 30, 30)
    } catch (error) {}

    doc.setFontSize(18)
    doc.text('SignalGO Academy - Reporte de Trading', 50, 18)

    doc.setFontSize(11)
    doc.text(`Rango: ${reportFrom || 'Inicio'} hasta ${reportTo || 'Hoy'}`, 50, 26)
    doc.text(`Profit total: $${formatMoney(reportProfit)}`, 14, 48)
    doc.text(`Trades: ${reportFilteredTrades.length}`, 14, 55)
    doc.text(`Win rate: ${reportWinRate}%`, 14, 62)
    doc.text(`Pips netos: ${formatMoney(reportPipsNet)}`, 14, 69)
    doc.text(`Pips ganados: ${formatMoney(reportPipsWon)}`, 14, 76)
    doc.text(`Pips perdidos: ${formatMoney(reportPipsLost)}`, 14, 83)

    autoTable(doc, {
      startY: 92,
      head: [['Fecha', 'Tipo', 'Setup', 'Profit', 'Pips', 'Nota']],
      body: reportFilteredTrades.map((trade) => [
        formatDateTime(trade.trade_date),
        trade.side === 'buy' ? 'Compra' : 'Venta',
        trade.setup_type || '-',
        `$${trade.profit_usd}`,
        trade.pips,
        trade.note || '-',
      ]),
    })

    doc.save('signalgo-reporte.pdf')
  }

  if (user) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6 md:py-10">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-8 rounded-3xl border border-yellow-500/30 bg-gradient-to-r from-black via-slate-950 to-slate-900 p-5 shadow-2xl md:p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <img
                  src="/logo.png"
                  alt="Signal Go Academy"
                  className="h-28 w-auto max-w-[220px] rounded-2xl object-contain sm:h-36 xl:h-44"
                />

                <div>
                  <h1 className="text-3xl font-bold tracking-wide md:text-4xl">
                    <span className="text-slate-300">Signal</span>
                    <span className="text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.9)]">
                      GO
                    </span>
                    <span className="text-slate-300"> Academy</span>
                  </h1>

                  <p className="mt-2 text-sm text-slate-400">
                    Centro de registro de trading y gestión del riesgo
                  </p>

                  <p className="mt-2 text-sm text-yellow-300">{profileName || user.email}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="https://www.forexfactory.com/calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-yellow-400 bg-yellow-500/10 px-5 py-3 text-center text-sm font-semibold text-yellow-300 hover:bg-yellow-500/20"
                >
                  Antes de operar consulta el calendario económico aquí
                </a>

                <button
                  onClick={downloadPDF}
                  className="rounded-full bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                >
                  Descargar PDF
                </button>

                <button
                  onClick={signOut}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-slate-200"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>

          {riskAlert && (
            <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
              {riskAlert}
            </div>
          )}

          <div className="mb-4 rounded-3xl border border-yellow-500/20 bg-[#0f172a] p-5 shadow-lg">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-bold">Resumen por periodo</h2>
                <p className="text-sm text-slate-400">Filtra las métricas por rango de fechas</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm text-slate-400">Desde</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                    value={statsFrom}
                    onChange={(e) => setStatsFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-400">Hasta</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                    value={statsTo}
                    onChange={(e) => setStatsTo(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearStatsFilter}
                    className="w-full rounded-xl bg-white p-3 font-semibold text-black hover:bg-slate-200"
                  >
                    Limpiar filtro
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-yellow-500/20 bg-slate-950 p-5 shadow-lg">
                <p className="text-sm text-slate-400">Profit total</p>
                <h3 className="mt-2 text-3xl font-bold text-yellow-400">
                  ${formatMoney(totalProfit)}
                </h3>
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-slate-950 p-5 shadow-lg">
                <p className="text-sm text-slate-400">Trades</p>
                <h3 className="mt-2 text-3xl font-bold text-white">{totalTrades}</h3>
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-slate-950 p-5 shadow-lg">
                <p className="text-sm text-slate-400">Win rate</p>
                <h3 className="mt-2 text-3xl font-bold text-white">{winRate}%</h3>
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-slate-950 p-5 shadow-lg">
                <p className="text-sm text-slate-400">Ganados</p>
                <h3 className="mt-2 text-3xl font-bold text-white">{winningTrades}</h3>
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-slate-950 p-5 shadow-lg">
                <p className="text-sm text-slate-400">Perdidos</p>
                <h3 className="mt-2 text-3xl font-bold text-white">{losingTrades}</h3>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-3xl border border-yellow-500/30 bg-[#0f172a] p-6 shadow-xl">
                <SectionHeader
                  title={editingTradeId ? 'Editar trade' : 'Nuevo trade'}
                  open={openTrade}
                  onToggle={() => setOpenTrade(!openTrade)}
                />

                {openTrade && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">
                      La fecha y hora se guardan automáticamente según el dispositivo.
                    </div>

                    <select
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={side}
                      onChange={(e) => setSide(e.target.value)}
                    >
                      <option value="buy">Compra</option>
                      <option value="sell">Venta</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Ganancia USD"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={profit}
                      onChange={(e) => setProfit(e.target.value)}
                    />

                    <input
                      type="number"
                      placeholder="Pips"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={pips}
                      onChange={(e) => setPips(e.target.value)}
                    />

                    <input
                      type="text"
                      placeholder="Setup"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={setupType}
                      onChange={(e) => setSetupType(e.target.value)}
                    />

                    <input
                      type="text"
                      placeholder="Confirmación de entrada"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />

                    <select
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                    >
                      <option value="Asia">Asia</option>
                      <option value="London">London</option>
                      <option value="New York">New York</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Nota del trade"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={saveTrade}
                        className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black transition hover:bg-yellow-400"
                      >
                        {editingTradeId ? 'Guardar cambios' : 'Guardar trade'}
                      </button>

                      {editingTradeId && (
                        <button
                          onClick={resetTradeForm}
                          className="w-full rounded-xl bg-white p-3 font-semibold text-black transition hover:bg-slate-200"
                        >
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-yellow-500/30 bg-[#0f172a] p-6 shadow-xl">
                <SectionHeader
                  title="Gestión de riesgo"
                  open={openRisk}
                  onToggle={() => setOpenRisk(!openRisk)}
                />

                {openRisk && (
                  <div className="space-y-4">
                    <input
                      type="number"
                      placeholder="Monto de cuenta"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={accountSize}
                      onChange={(e) => setAccountSize(e.target.value)}
                    />

                    <input
                      type="number"
                      placeholder="Pérdida máxima diaria"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={dailyLossLimit}
                      onChange={(e) => setDailyLossLimit(e.target.value)}
                    />

                    <input
                      type="number"
                      placeholder="Objetivo diario"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={dailyProfitTarget}
                      onChange={(e) => setDailyProfitTarget(e.target.value)}
                    />

                    <input
                      type="number"
                      placeholder="Riesgo por trade %"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={riskPerTrade}
                      onChange={(e) => setRiskPerTrade(e.target.value)}
                    />

                    <input
                      type="number"
                      placeholder="Máximo trades por día"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={maxTradesPerDay}
                      onChange={(e) => setMaxTradesPerDay(e.target.value)}
                    />

                    <button
                      onClick={saveRiskSettings}
                      className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black transition hover:bg-yellow-400"
                    >
                      Guardar gestión de riesgo
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-yellow-500/30 bg-[#0f172a] p-6 shadow-xl">
                <SectionHeader
                  title="Curva de ganancias"
                  open={openChart}
                  onToggle={() => setOpenChart(!openChart)}
                />

                {openChart && (
                  <div className="h-80 rounded-2xl bg-slate-950 p-4">
                    {chartData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        No hay datos para el gráfico
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="balance"
                            stroke="#facc15"
                            strokeWidth={3}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-yellow-500/30 bg-[#0f172a] p-6 shadow-xl">
                <SectionHeader
                  title="Reporte PDF"
                  open={openReport}
                  onToggle={() => setOpenReport(!openReport)}
                />

                {openReport && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm text-slate-400">Desde</label>
                        <input
                          type="date"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                          value={reportFrom}
                          onChange={(e) => setReportFrom(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-slate-400">Hasta</label>
                        <input
                          type="date"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                          value={reportTo}
                          onChange={(e) => setReportTo(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl bg-slate-950 p-4">
                        <p className="text-sm text-slate-400">Pips netos</p>
                        <p className="mt-2 text-xl font-bold text-white">
                          {formatMoney(reportPipsNet)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-950 p-4">
                        <p className="text-sm text-slate-400">Pips ganados</p>
                        <p className="mt-2 text-xl font-bold text-green-400">
                          {formatMoney(reportPipsWon)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-950 p-4">
                        <p className="text-sm text-slate-400">Pips perdidos</p>
                        <p className="mt-2 text-xl font-bold text-red-400">
                          {formatMoney(reportPipsLost)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={downloadPDF}
                      className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black transition hover:bg-yellow-400"
                    >
                      Generar PDF del rango seleccionado
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-yellow-500/30 bg-[#0f172a] p-6 shadow-xl">
                <SectionHeader
                  title="Perfil"
                  open={openProfile}
                  onToggle={() => setOpenProfile(!openProfile)}
                />

                {openProfile && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={avatarUrl || '/logo.png'}
                        alt="Perfil"
                        onError={(e) => {
                          e.currentTarget.src = '/logo.png'
                        }}
                        className="h-20 w-20 rounded-full border border-yellow-500/30 bg-slate-950 object-cover"
                      />
                      <div className="text-sm text-slate-400">
                        Puedes subir una foto desde tu dispositivo o pegar un enlace.
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Nombre"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                    />

                    <input
                      type="text"
                      placeholder="URL de foto de perfil (opcional)"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />

                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                      <label className="mb-2 block text-sm text-slate-400">
                        O subir imagen desde tu dispositivo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full text-sm text-white"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          setAvatarFile(file)
                        }}
                      />
                      {avatarFile && (
                        <p className="mt-2 text-xs text-yellow-300">
                          Archivo seleccionado: {avatarFile.name}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={saveProfile}
                      disabled={uploadingAvatar}
                      className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadingAvatar ? 'Subiendo foto y guardando...' : 'Guardar perfil'}
                    </button>

                    <div className="border-t border-slate-800 pt-4">
                      <input
                        type="password"
                        placeholder="Nueva contraseña"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />

                      <button
                        onClick={updatePassword}
                        className="mt-4 w-full rounded-xl bg-white p-3 font-semibold text-black transition hover:bg-slate-200"
                      >
                        Cambiar contraseña
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-yellow-500/30 bg-[#0f172a] p-6 shadow-xl">
                <SectionHeader
                  title="Modo psicólogo"
                  open={openPsychology}
                  onToggle={() => setOpenPsychology(!openPsychology)}
                />

                {openPsychology && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
                      <p className="font-semibold text-yellow-300">Este es tu espacio privado.</p>
                      <p className="mt-2">
                        Aquí puedes agregar notas a cada día de trading, cómo te fue, cuáles
                        fueron tus errores, si sobreoperaste o te mantuviste alineado con tu plan
                        de trading. Es tu diario emocional de psicotrading.
                      </p>
                    </div>

                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={psychoDate}
                      onChange={(e) => setPsychoDate(e.target.value)}
                    />

                    <input
                      type="text"
                      placeholder="Título opcional"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      value={psychoTitle}
                      onChange={(e) => setPsychoTitle(e.target.value)}
                    />

                    <textarea
                      placeholder="Escribe aquí tu diario emocional..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                      rows="6"
                      value={psychoContent}
                      onChange={(e) => setPsychoContent(e.target.value)}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={savePsychoNote}
                        className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black transition hover:bg-yellow-400"
                      >
                        {editingPsychoId ? 'Guardar cambios' : 'Guardar nota emocional'}
                      </button>

                      {editingPsychoId && (
                        <button
                          onClick={resetPsychoForm}
                          className="w-full rounded-xl bg-white p-3 font-semibold text-black transition hover:bg-slate-200"
                        >
                          Cancelar edición
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {psychoNotes.length === 0 && (
                        <p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                          Aún no tienes notas emocionales guardadas.
                        </p>
                      )}

                      {psychoNotes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-2xl border border-slate-700 bg-slate-950 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold text-black">
                              {note.note_date}
                            </span>
                          </div>

                          <div className="rounded-xl bg-slate-900 p-3 text-sm">
                            <p className="text-slate-400">Título</p>
                            <p className="mt-1 text-white">{note.title || '-'}</p>
                          </div>

                          <div className="mt-3 rounded-xl bg-slate-900 p-3 text-sm">
                            <p className="text-slate-400">Diario emocional</p>
                            <p className="mt-1 whitespace-pre-line text-white">{note.content}</p>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <button
                              onClick={() => startEditPsychoNote(note)}
                              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-yellow-400"
                            >
                              Editar
                            </button>

                            <button
                              onClick={() => deletePsychoNote(note.id)}
                              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-yellow-500/30 bg-[#0f172a] p-6 shadow-xl">
                <SectionHeader
                  title="Calendario de resultados"
                  open={openCalendar}
                  onToggle={() => setOpenCalendar(!openCalendar)}
                />

                {openCalendar && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <button
                        onClick={goPrevMonth}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                      >
                        ◀
                      </button>

                      <h3 className="text-lg font-bold">
                        {calendarMonth.toLocaleString('es-ES', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </h3>

                      <button
                        onClick={goNextMonth}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                      >
                        ▶
                      </button>
                    </div>

                    <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-slate-400">
                      <div>Dom</div>
                      <div>Lun</div>
                      <div>Mar</div>
                      <div>Mié</div>
                      <div>Jue</div>
                      <div>Vie</div>
                      <div>Sáb</div>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {monthCells.map((cell, index) => {
                        if (!cell) {
                          return <div key={index} className="h-20 rounded-xl bg-slate-950/40" />
                        }

                        const key = formatDayKey(cell)
                        const dayPnl = pnlByDay[key] || 0
                        const isSelected = selectedCalendarDate === key

                        let bgClass = 'bg-slate-950'
                        if (dayPnl > 0) bgClass = 'bg-green-900/50 border border-green-500/30'
                        if (dayPnl < 0) bgClass = 'bg-red-900/50 border border-red-500/30'
                        if (isSelected) bgClass += ' ring-2 ring-yellow-400'

                        return (
                          <button
                            key={index}
                            onClick={() => handleCalendarDayClick(cell)}
                            className={`h-20 rounded-xl p-2 text-left text-sm ${bgClass}`}
                          >
                            <div className="font-bold">{cell.getDate()}</div>
                            <div className="mt-2 text-xs">
                              {dayPnl > 0 && (
                                <span className="text-green-300">+${formatMoney(dayPnl)}</span>
                              )}
                              {dayPnl < 0 && (
                                <span className="text-red-300">${formatMoney(dayPnl)}</span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-yellow-500/30 bg-[#0f172a] p-6 shadow-xl">
                <SectionHeader
                  title="Tus trades"
                  open={openHistory}
                  onToggle={() => setOpenHistory(!openHistory)}
                />

                {openHistory && (
                  <>
                    {selectedCalendarDate && (
                      <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-950 p-4 text-sm">
                        <span>
                          Mostrando trades del día: <strong>{selectedCalendarDate}</strong>
                        </span>
                        <button
                          onClick={clearCalendarFilter}
                          className="rounded-lg bg-yellow-500 px-3 py-2 font-semibold text-black"
                        >
                          Ver todos
                        </button>
                      </div>
                    )}

                    {displayedTrades.length === 0 && (
                      <p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                        No hay trades para mostrar
                      </p>
                    )}

                    <div className="max-h-[700px] space-y-4 overflow-y-auto pr-1">
                      {displayedTrades.map((trade) => (
                        <div
                          key={trade.id}
                          className="rounded-2xl border border-slate-700 bg-slate-950 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold text-black">
                              {trade.side === 'buy' ? 'Compra' : 'Venta'}
                            </span>
                            <span className="text-sm text-slate-400">
                              {formatDateTime(trade.trade_date)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-slate-900 p-3">
                              <p className="text-slate-400">Profit</p>
                              <p className="font-bold text-white">${trade.profit_usd}</p>
                            </div>

                            <div className="rounded-xl bg-slate-900 p-3">
                              <p className="text-slate-400">Pips</p>
                              <p className="font-bold text-white">{trade.pips}</p>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                            <div className="rounded-xl bg-slate-900 p-3">
                              <p className="text-slate-400">Setup</p>
                              <p className="mt-1 text-white">{trade.setup_type || '-'}</p>
                            </div>

                            <div className="rounded-xl bg-slate-900 p-3">
                              <p className="text-slate-400">Confirmación</p>
                              <p className="mt-1 text-white">{trade.confirmation || '-'}</p>
                            </div>
                          </div>

                          <div className="mt-3 rounded-xl bg-slate-900 p-3 text-sm">
                            <p className="text-slate-400">Sesión</p>
                            <p className="mt-1 text-white">{trade.session || '-'}</p>
                          </div>

                          <div className="mt-3 rounded-xl bg-slate-900 p-3 text-sm">
                            <p className="text-slate-400">Nota</p>
                            <p className="mt-1 text-white">{trade.note || '-'}</p>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <button
                              onClick={() => startEditTrade(trade)}
                              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-yellow-400"
                            >
                              Editar
                            </button>

                            <button
                              onClick={() => deleteTrade(trade.id)}
                              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {message && (
            <p className="mt-6 rounded-xl bg-slate-950 px-4 py-3 text-sm text-yellow-300">
              {message}
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-yellow-500/30 bg-[#0f172a] shadow-2xl lg:grid-cols-2">
          <div className="flex flex-col justify-center bg-gradient-to-br from-black via-slate-950 to-slate-900 p-8">
            <div className="mb-6 flex items-center gap-4">
              <img src="/logo.png" alt="Signal Go Academy" className="h-24 object-contain" />
              <div>
                <h1 className="text-4xl font-bold">
                  <span className="text-slate-300">Signal</span>
                  <span className="text-yellow-400">GO</span>
                  <span className="text-slate-300"> Academy</span>
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Centro de registro de trading y gestión del riesgo
                </p>
              </div>
            </div>

            <div className="mb-6">
              <a
                href="https://www.forexfactory.com/calendar"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-full border border-yellow-400 bg-yellow-500/10 px-5 py-3 text-sm font-semibold text-yellow-300 hover:bg-yellow-500/20"
              >
                Antes de operar consulta el calendario económico aquí
              </a>
            </div>

            <p className="max-w-md text-slate-300">
              Accede a tu panel privado para registrar operaciones, analizar tu rendimiento y
              llevar un control profesional de tu operativa en XAUUSD.
            </p>
          </div>

          <div className="p-8">
            <h2 className="mb-2 text-2xl font-bold text-white">Acceso</h2>
            <p className="mb-6 text-sm text-slate-300">
              Inicia sesión o crea tu cuenta para entrar.
            </p>

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Correo"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Contraseña"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                onClick={signIn}
                className="w-full rounded-xl bg-white p-3 font-semibold text-black transition hover:bg-slate-200"
              >
                Iniciar sesión
              </button>

              <button
                onClick={signUp}
                className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black transition hover:bg-yellow-400"
              >
                Crear cuenta
              </button>
            </div>

            {message && (
              <p className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm text-yellow-300">
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}