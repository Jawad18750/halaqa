import React from 'react'

export default function Privacy({ onBack }) {
  return (
    <div style={{ padding: 16, maxWidth: 840, margin: '0 auto' }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
        <button className="btn" onClick={onBack}>← الرجوع</button>
      </div>
      <div className="card appear" style={{ display:'grid', gap:12 }}>
        <h2 style={{ textAlign:'center' }}>سياسة الخصوصية</h2>
        <p className="info-value">نلتزم بحماية خصوصية المستخدمين. تُستخدم بيانات الطلاب والاختبارات فقط لأغراض إدارة الحلقة وعرض الإحصاءات للشيخ.</p>
        <div className="info-grid info-grid--fit">
          <div className="info"><div className="info-label"><i className="fa-solid fa-lock" style={{ marginInlineStart:6 }}></i> البيانات المخزنة</div><div className="info-value">أسماء الطلاب وأرقامهم وملاحظاتهم وسجل الاختبارات (الفتحة/التردد/النتيجة/التاريخ).</div></div>
          <div className="info"><div className="info-label"><i className="fa-solid fa-ban" style={{ marginInlineStart:6 }}></i> عدم المشاركة</div><div className="info-value">لا نشارك البيانات مع أطراف ثالثة. يمكن حذف أي طالب وسجلاته من قبل الشيخ.</div></div>
          <div className="info"><div className="info-label"><i className="fa-solid fa-user-shield" style={{ marginInlineStart:6 }}></i> الوصول</div><div className="info-value">حساب الشيخ فقط يمكنه دخول بياناته عبر تسجيل الدخول.</div></div>
        </div>
      </div>
      <div className="card appear" style={{ marginTop:12 }}>
        <h2 style={{ textAlign:'center' }}>شروط الاستخدام</h2>
        <p className="info-value">باستخدام التطبيق، فإنك توافق على: (1) إدخال بيانات صحيحة، (2) عدم إساءة استخدام النظام، (3) احترام حقوق الطلاب، (4) الالتزام بالقوانين المحلية.</p>
      </div>
    </div>
  )
}
