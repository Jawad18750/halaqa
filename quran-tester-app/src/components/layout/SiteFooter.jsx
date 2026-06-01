const BUILD_TAG = import.meta.env.VITE_BUILD_TAG || 'dev'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <a href="https://abdeljawad.com" target="_blank" rel="noopener noreferrer">
        <img className="site-footer__logo" src="/logo.svg" alt="شعار عبد الجواد" width="20" height="20" />
        <span>طُور بواسطة عبدالجواد الميلادي</span>
      </a>
      <p className="site-footer__note">لا تنسونا من صالح دعائكم لي ولوالديّ ولأسرتي</p>
      <p className="site-footer__version">الإصدار: {BUILD_TAG}</p>
    </footer>
  )
}
