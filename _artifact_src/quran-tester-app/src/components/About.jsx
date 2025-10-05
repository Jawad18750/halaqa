import React from 'react'

export default function About({ onBack }) {
  return (
    <div style={{ padding: 16, maxWidth: 840, margin: '0 auto' }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
        <button className="btn" onClick={onBack}>← الرجوع</button>
      </div>
      <div className="card appear" style={{ display:'grid', gap:12 }}>
        <h2 style={{ textAlign:'center' }}>عن التطبيق</h2>
        <p className="info-value">هذا التطبيق صُمّم لخدمة الحلقات القرآنية بإدارة الطلاب، والاختبارات الأسبوعية، وتتبّع الأداء، مع واجهة عربية بالكامل ودعم للهاتف المحمول.</p>
        <div className="info-grid info-grid--fit">
          <div className="info"><div className="info-label"><i className="fa-solid fa-book-quran" style={{ marginInlineStart:6 }}></i> الهدف</div><div className="info-value">اختبارات عشوائية للأثمان مع تسجيل الفتحة والتردد والنجاح والفشل.</div></div>
          <div className="info"><div className="info-label"><i className="fa-solid fa-shield-halved" style={{ marginInlineStart:6 }}></i> الخصوصية</div><div className="info-value">لا تُشارك بيانات الطلاب خارج حساب الشيخ. كل البيانات تحت سيطرة المستخدم.</div></div>
          <div className="info"><div className="info-label"><i className="fa-solid fa-mobile-screen" style={{ marginInlineStart:6 }}></i> التجربة</div><div className="info-value">تصميم مبسّط مريح للهاتف مع وضع داكن وتباين عالٍ عند الحاجة.</div></div>
        </div>
      </div>
      <div className="card appear" style={{ marginTop:12 }}>
        <h2 style={{ textAlign:'center' }}>الاعتمادات</h2>
        <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:6 }}>
          <li><i className="fa-solid fa-code" style={{ marginInlineStart:6 }}></i> المطور: عبدالجواد الميلادي</li>
          <li><i className="fa-solid fa-database" style={{ marginInlineStart:6 }}></i> بيانات الأثمان: مصفوفة محلية من مصحف ليبيا رواية قالون عن نافع (ليبيا)</li>
          <li><i className="fa-solid fa-font" style={{ marginInlineStart:6 }}></i> الخط: IBM Plex Sans Arabic</li>
        </ul>
      </div>
    </div>
  )
}
