#!/usr/bin/env node
/** Regenerate affected verification previews. Run: node scripts/generate-affected-previews.mjs */
import { buildInviteMessageForChannel } from '../quran-tester-app/src/lib/guardianInvite.js'
import { joinMessageBlocks } from '../quran-tester-app/src/lib/messageContext.js'
import { buildSessionResultMessage } from '../server/src/lib/sessionMessage.js'
import { buildHalaqaSignature } from '../quran-tester-app/src/lib/messageContext.js'

const ctx = {
  sheikhName: 'عبدالرحمن الغرياني',
  masjidName: 'مسجد الشابش',
}
const inviteParams = {
  guardianName: 'الأستاذ أحمد',
  studentName: 'محمد أحمد',
  code: '482917',
  deepLink: 'https://t.me/Halaqa_Test_bot?start=482917',
  ...ctx,
}

function section(n, title, body) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`${n}. ${title}`)
  console.log('='.repeat(60))
  console.log(body)
  console.log('\n--- escaped preview (\\n visible) ---')
  console.log(JSON.stringify(body))
}

function formatDateLabel(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('ar-EG', {
    day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn',
  })
}

function buildWeeklyReportMessage(item, from, to, { sheikhName, masjidName, includeRank = false } = {}) {
  const halaqaFooter = buildHalaqaSignature({ sheikhName, masjidName, style: 'footer' })
  const headerLines = [
    `الطالب: ${item.student_name}`,
    `الفترة: من ${formatDateLabel(from)} إلى ${formatDateLabel(to)}`,
  ]
  if (includeRank) headerLines.push(`ترتيب الطالب في الحلقة: ${item.rank}`)
  return joinMessageBlocks([
    '📊 التقرير الأسبوعي لمتابعة الطالب',
    headerLines,
    [
      `عدد الاختبارات: ${item.attempts}`,
      `متوسط الدرجات: ${item.avgScore}`,
      `أعلى درجة: ${item.bestScore}`,
      `نسبة الاختبارات المجتازة: ${item.passRate}%`,
    ],
    'هذه رسالة متابعة من حلقة القرآن الكريم، ولا يلزم الرد عليها.',
    halaqaFooter,
    `🤲 بارك الله في ${item.student_name}، ووفقه للمراجعة والإتقان.`,
  ])
}

const weeklyItem = {
  student_name: 'محمد أحمد',
  rank: 3,
  attempts: 4,
  avgScore: 78.5,
  bestScore: 85,
  passRate: 75,
}

section(1, 'Telegram/copy invite', buildInviteMessageForChannel('telegram', inviteParams))
section(2, 'WhatsApp invite', buildInviteMessageForChannel('whatsapp', inviteParams))
section(3, 'Successful automatic result (deduplicated naqza details)', buildSessionResultMessage({
  studentName: 'محمد أحمد',
  session: { passed: true, score: 85, mode: 'naqza', thumun_id: 1, naqza: 1, attempt_at: '2026-05-31T15:30:00.000Z' },
  ...ctx,
}))
section(4, 'Needs-review automatic result', buildSessionResultMessage({
  studentName: 'محمد أحمد',
  session: { passed: false, score: 45, mode: 'juz', thumun_id: 2, attempt_at: '2026-05-31T15:30:00.000Z' },
  ...ctx,
}))
section(5, 'Weekly report', buildWeeklyReportMessage(weeklyItem, '2026-05-25', '2026-05-31', ctx))
section(6, 'Dashboard feature announcement', 'يمكن الآن إرسال نتائج الاختبارات تلقائيًا إلى أولياء الأمور المرتبطين عبر Telegram.')
section(7, 'Telegram revocation confirmation (guardian-level — all linked students)', [
  'Title: إلغاء ربط Telegram',
  '',
  'Body: سيؤدي إلغاء الربط إلى توقف وصول نتائج جميع الطلاب المرتبطين بولي الأمر عبر Telegram، وسيحتاج ولي الأمر إلى رابط جديد لإعادة الربط. هل تريد المتابعة؟',
  '',
  'Confirm: إلغاء الربط',
  'Cancel: تراجع',
  '',
  'Verified scope: DELETE FROM guardian_telegram WHERE guardian_id = … removes Telegram for the entire guardian account, affecting every linked student.',
].join('\n'))
section(8, 'Successful result — no mosque/sheikh settings', buildSessionResultMessage({
  studentName: 'محمد أحمد',
  session: { passed: true, score: 85, mode: 'juz', thumun_id: 2, attempt_at: '2026-05-31T15:30:00.000Z' },
}))
