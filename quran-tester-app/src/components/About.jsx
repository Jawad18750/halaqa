import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'
import StatTile from './ui/StatTile.jsx'

export default function About({ onBack }) {
  return (
    <div className="stack">
      <PageHeader title="عن التطبيق" onBack={onBack} />
      <SectionCard>
        <p className="prose">هذا التطبيق صُمّم لخدمة الحلقات القرآنية بإدارة الطلاب، والاختبارات الأسبوعية، وتتبّع الأداء، مع واجهة عربية بالكامل ودعم للهاتف المحمول.</p>
        <div className="stat-grid stat-grid--fit" style={{ marginTop: 16 }}>
          <StatTile label="الهدف" value="اختبارات عشوائية للأثمان مع تسجيل الفتحة والتردد" />
          <StatTile label="الخصوصية" value="بيانات الطلاب تحت سيطرة المعلّم فقط" />
          <StatTile label="التجربة" value="تصميم مريح للهاتف مع وضع داكن" />
        </div>
      </SectionCard>
      <SectionCard title="إسهامات">
        <ul className="prose" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <li><i className="fa-solid fa-lightbulb" style={{ marginInlineEnd: 8 }} />صاحب الفكرة: الشيخ عبدالرحمن الغرياني</li>
          <li><i className="fa-solid fa-code" style={{ marginInlineEnd: 8 }} />المطور: عبدالجواد الميلادي</li>
          <li><i className="fa-solid fa-database" style={{ marginInlineEnd: 8 }} />بيانات الأثمان: مصحف ليبيا — رواية قالون عن نافع</li>
          <li><i className="fa-solid fa-font" style={{ marginInlineEnd: 8 }} />الخط: IBM Plex Sans Arabic</li>
        </ul>
      </SectionCard>
      <p className="meta" style={{ textAlign: 'center' }}>
        © {new Date().getFullYear()} حلقة — جميع الحقوق محفوظة
        {' · '}
        <a href="/status.html" target="_blank" rel="noopener noreferrer">حالة النظام</a>
      </p>
    </div>
  )
}
