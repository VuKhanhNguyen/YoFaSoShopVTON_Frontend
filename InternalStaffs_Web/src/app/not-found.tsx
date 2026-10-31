import Image from "next/image";
import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <Image src="/brand/logo.png" alt="YoFaSo Shop" width={170} height={96} />
      <p className="error-number">404</p>
      <h1>Trang này đã lạc mất</h1>
      <p>Đường dẫn không tồn tại hoặc nội dung đã được chuyển.</p>
      <Link className="button" href="/workspace/dashboard">
        Về trang tổng quan
      </Link>
    </main>
  );
}
