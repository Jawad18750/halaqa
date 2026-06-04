#!/usr/bin/env node
/**
 * Generates full untruncated message previews for verification.
 * Run: node scripts/generate-message-previews.mjs
 */
import { buildInviteMessageForChannel, inviteChannelToast } from '../quran-tester-app/src/lib/guardianInvite.js'
import { appendSignatureFooter, buildHalaqaSignature } from '../quran-tester-app/src/lib/messageContext.js'
import { buildSessionResultMessage } from '../server/src/lib/sessionMessage.js'
import { buildWeeklyAttendanceGuardianMessage } from '../server/src/lib/attendanceService.js'

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
}

function formatDateLabel(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('ar-EG', {
    day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn',
  })
}

function buildWeeklyReportMessage(item, from, to, { sheikhName, masjidName, includeRank = false } = {}) {
  const halaqaFooter = buildHalaqaSignature({ sheikhName, masjidName, style: 'footer' })
  const lines = [
    '📊 التقرير الأسبوعي لمتابعة الطالب',
    `الطالب: ${item.student_name}`,
    `الفترة: من ${formatDateLabel(from)} إلى ${formatDateLabel(to)}`,
  ]
  if (includeRank) lines.push(`ترتيب الطالب في الحلقة: ${item.rank}`)
  lines.push(
    `عدد الاختبارات: ${item.attempts}`,
    `متوسط الدرجات: ${item.avgScore}`,
    `أعلى درجة: ${item.bestScore}`,
    `نسبة الاختبارات المجتازة: ${item.passRate}%`,
    'هذه رسالة متابعة من حلقة القرآن الكريم، ولا يلزم الرد عليها.',
  )
  if (halaqaFooter) lines.push(halaqaFooter)
  lines.push(`🤲 بارك الله في ${item.student_name}، ووفقه للمراجعة والإتقان.`)
  return lines.join('\n')
}

function buildSuccessLinkMessage({ guardianName, studentNames, sheikhName, masjidName }) {
  const halaqaFooter = buildHalaqaSignature({ sheikhName, masjidName, style: 'footer' })
  const gName = String(guardianName || '').trim()
  const names = studentNames.filter(Boolean)
  const lines = ['✅ تم الربط بنجاح.']
  if (gName) lines.push(`ولي الأمر: ${gName}`)
  if (names.length === 1) lines.push(`الطالب المرتبط: ${names[0]}`)
  else if (names.length > 1) lines.push(`الطلاب المرتبطون: ${names.join('، ')}`)
  lines.push(
    'من الآن، ستصلكم نتائج الاختبارات تلقائيًا عبر هذا البوت.',
    'لإيقاف الإشعارات أرسلوا: /stop',
  )
  if (halaqaFooter) lines.push(halaqaFooter)
  lines.push('بارك الله فيكم.')
  return lines.join('\n')
}

const weeklyItem = {
  student_name: 'محمد أحمد',
  rank: 3,
  attempts: 4,
  avgScore: 78.5,
  bestScore: 85,
  passRate: 75,
}

section(1, 'Telegram/copy guardian invitation', buildInviteMessageForChannel('telegram', inviteParams))
section(2, 'WhatsApp guardian invitation', buildInviteMessageForChannel('whatsapp', inviteParams))
section(3, 'SMS guardian invitation', buildInviteMessageForChannel('sms', inviteParams))

const sampleStudent = { memorization_thumun_id: 142 }
const sampleSessionPass = {
  passed: true,
  score: 85,
  mode: 'naqza',
  thumun_id: 1,
  naqza: 1,
  test_try_number: 2,
  attempt_at: '2026-05-31T15:30:00.000Z',
}

section(4, 'Successful automatic test result (memorization + qalam)', buildSessionResultMessage({
  studentName: 'محمد أحمد',
  student: sampleStudent,
  session: sampleSessionPass,
  ...ctx,
}))

section(5, 'Needs-review automatic test result', buildSessionResultMessage({
  studentName: 'محمد أحمد',
  student: sampleStudent,
  session: { passed: false, score: 45, mode: 'juz', thumun_id: 2, test_try_number: 1, attempt_at: '2026-05-31T15:30:00.000Z' },
  ...ctx,
}))

section('4b', 'Weekly guardian attendance (with memorization, no qalam)', buildWeeklyAttendanceGuardianMessage({
  studentName: 'محمد أحمد',
  student: sampleStudent,
  summary: { from: '2026-05-30', to: '2026-06-05', presentCount: 3, absentCount: 2, studyDayCount: 5 },
  statuses: [
    { date: '2026-05-30', status: 'present' },
    { date: '2026-05-31', status: 'absent' },
    { date: '2026-06-01', status: 'present' },
  ],
  ...ctx,
}))

section(6, 'Weekly report without ranking', buildWeeklyReportMessage(weeklyItem, '2026-05-25', '2026-05-31', { ...ctx, includeRank: false }))
section(7, 'Weekly report with ranking', buildWeeklyReportMessage(weeklyItem, '2026-05-25', '2026-05-31', { ...ctx, includeRank: true }))

section(8, 'Bot /start', [
  'السلام عليكم ورحمة الله وبركاته.',
  '📖 هذا هو بوت متابعة نتائج الطلاب في حلقة القرآن الكريم.',
  'لربط حسابكم بولي الأمر:',
  '1. اضغطوا رابط الدعوة الذي أرسله معلّم الحلقة.',
  '2. أو أرسلوا رمز الربط المكوّن من 6 أرقام.',
  'بعد إتمام الربط، ستصلكم نتائج الاختبارات تلقائيًا عبر هذا البوت.',
  'للمساعدة أرسلوا: /help',
].join('\n'))

section(9, 'Bot /help', [
  '📖 مساعدة بوت حلقة القرآن الكريم',
  'للربط:',
  '- اضغطوا رابط الدعوة الذي أرسله معلّم الحلقة.',
  '- أو أرسلوا رمز الربط المكوّن من 6 أرقام.',
  'بعد الربط:',
  '- ستصلكم نتائج الاختبارات تلقائيًا.',
  '- لإيقاف الإشعارات أرسلوا: /stop',
  '- لإعادة تفعيل الإشعارات أرسلوا: /resume',
  'إذا انتهت صلاحية رمز الربط، اطلبوا رمزًا جديدًا من معلّم الحلقة.',
].join('\n'))

section(10, 'Bot successful link — one student', buildSuccessLinkMessage({
  guardianName: 'الأستاذ أحمد',
  studentNames: ['محمد أحمد'],
  ...ctx,
}))

section(11, 'Bot successful link — multiple students', buildSuccessLinkMessage({
  guardianName: 'الأستاذ أحمد',
  studentNames: ['محمد أحمد', 'سارة أحمد'],
  ...ctx,
}))

section(12, 'Invalid/expired code response', [
  'تعذّر إتمام الربط بهذا الرمز.',
  'يرجى التأكد من إدخال رمز الربط كما أرسله معلّم الحلقة، أو طلب رمز جديد إذا انتهت صلاحيته.',
  'مثال: 482 917',
].join('\n'))

section(13, 'Technical link-error response', '⚠️ تعذّر إتمام الربط حاليًا بسبب خطأ تقني.\nيرجى المحاولة مرة أخرى، وإذا استمرت المشكلة فتواصلوا مع معلّم الحلقة.')

section(14, '/stop success', '🔕 تم إيقاف إشعارات النتائج.\nلإعادة تفعيل الإشعارات أرسلوا: /resume')
section(15, '/resume success', '🔔 تم تفعيل إشعارات النتائج من جديد.\nستصلكم نتائج الاختبارات القادمة تلقائيًا عبر هذا البوت.')
section(16, '/stop when no link exists', 'لا يوجد حساب طالب مرتبط بهذا الحساب حاليًا.\nللربط، استخدموا الرابط أو الرمز المرسل من معلّم الحلقة.')

section(17, 'Unrecognized bot message', [
  'لم نتمكن من فهم الرسالة.',
  'يرجى إرسال رمز الربط المكوّن من 6 أرقام، أو استخدام رابط الدعوة الذي أرسله معلّم الحلقة.',
  'للمساعدة أرسلوا: /help',
].join('\n'))

const resetLink = 'https://example.com/reset?token=abc123'
section(18, 'Password reset email', `Subject: إعادة تعيين كلمة المرور — حلقة\n\n${[
  'السلام عليكم،',
  'تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابكم في تطبيق حلقة.',
  'لإنشاء كلمة مرور جديدة، افتحوا الرابط التالي خلال ساعة واحدة:',
  resetLink,
  'إذا لم تطلبوا إعادة تعيين كلمة المرور، يمكنكم تجاهل هذه الرسالة، ولن يتم تغيير كلمة المرور الحالية.',
  'فريق تطبيق حلقة',
].join('\n')}`)

const broadcastBody = 'نود إبلاغكم بموعد المراجعة الأسبوعية يوم الأربعاء.'
section(19, 'Broadcast message with signature', appendSignatureFooter(broadcastBody, ctx))

const customBody = 'نبارك لكم تقدّم الطالب هذا الأسبوع، وننصح بمراجعة جزء عمّ.'
section(20, 'Custom guardian message with signature', appendSignatureFooter(customBody, ctx))

section(21, 'Dashboard announcements', [
  '--- Announcement 1 (needs invite) ---',
  'Title: 2 من أولياء الأمور لم يتم ربطهم بعد',
  'Body: أرسل رابط الربط عبر واتساب أو Telegram أو رسالة نصية، حتى يتمكن ولي الأمر من استلام نتائج الطالب تلقائيًا.',
  '',
  '--- Announcement 2 (no guardian) ---',
  'Title: 1 طالب دون ولي أمر مسجّل',
  'Body: أضف بيانات ولي الأمر من ملف الطالب لتفعيل متابعة النتائج والإشعارات.',
  '',
  '--- Announcement 3 (feature) ---',
  'Title: ميزة جديدة: إشعارات أولياء الأمور',
  'Body: يمكن الآن إرسال نتائج الاختبارات تلقائيًا إلى أولياء الأمور المربوطين عبر Telegram.',
].join('\n'))

section(22, 'Invite-app toast messages', [
  `WhatsApp: ${inviteChannelToast('whatsapp')}`,
  `SMS: ${inviteChannelToast('sms')}`,
  `Telegram: ${inviteChannelToast('telegram')}`,
].join('\n'))

// Preview without mosque/sheikh settings
section('BONUS', 'Successful result — no mosque/sheikh settings', buildSessionResultMessage({
  studentName: 'محمد أحمد',
  session: { passed: true, score: 85, mode: 'juz', thumun_id: 2, attempt_at: '2026-05-31T15:30:00.000Z' },
}))

console.log('\n')
