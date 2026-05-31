import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'
import StatTile from './ui/StatTile.jsx'

export default function Privacy({ onBack }) {
  return (
    <div className="stack">
      <PageHeader title="الخصوصية وشروط الاستخدام" onBack={onBack} />
      <SectionCard title="سياسة الخصوصية">
        <p className="prose">نلتزم بحماية خصوصية المستخدمين. تُستخدم بيانات الطلاب والاختبارات فقط لأغراض إدارة الحلقة وعرض الإحصاءات للشيخ.</p>
        <div className="stat-grid stat-grid--fit" style={{ marginTop: 16 }}>
          <StatTile label="البيانات المخزنة" value="أسماء الطلاب وأرقامهم وسجل الاختبارات" />
          <StatTile label="عدم المشاركة" value="لا نشارك البيانات مع أطراف ثالثة" />
          <StatTile label="الوصول" value="حساب الشيخ فقط يمكنه الوصول لبياناته" />
        </div>
      </SectionCard>
      <SectionCard title="شروط الاستخدام">
        <p className="prose">باستخدام التطبيق، فإنك توافق على: (1) إدخال بيانات صحيحة، (2) عدم إساءة استخدام النظام، (3) احترام حقوق الطلاب، (4) الالتزام بالقوانين المحلية.</p>
      </SectionCard>
    </div>
  )
}
