"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <h1>Chưa tải được trang</h1>
      <p>Vui lòng thử lại. Nếu vẫn lỗi, kiểm tra kết nối dịch vụ.</p>
      <button onClick={reset}>Thử lại</button>
    </main>
  );
}
