const STYLE = `
@keyframes vf-pulse {
  0%   { opacity: 1; }
  50%  { opacity: .4; }
  100% { opacity: 1; }
}
.vf-skeleton-bar {
  border-radius: 6px;
  background: #d4ece4;
  animation: vf-pulse 1.4s ease-in-out infinite;
}
`;

let injected = false;
function injectStyle() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.textContent = STYLE;
  document.head.appendChild(el);
}

function Bar({ w = "100%", h = 16, mb = 10 }: { w?: string | number; h?: number; mb?: number }) {
  return (
    <div
      className="vf-skeleton-bar"
      style={{ width: w, height: h, marginBottom: mb }}
    />
  );
}

export default function PageSkeleton() {
  injectStyle();
  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      {/* Page heading */}
      <Bar w={220} h={26} mb={8} />
      <Bar w={340} h={14} mb={32} />

      {/* Card 1 */}
      <div style={{ background: "#fff", border: "1px solid #d4ece4", borderRadius: 10,
                    padding: 24, marginBottom: 16 }}>
        <Bar w={140} h={13} mb={18} />
        <Bar w="100%" h={14} mb={10} />
        <Bar w="85%"  h={14} mb={10} />
        <Bar w="70%"  h={14} mb={0} />
      </div>

      {/* Card 2 */}
      <div style={{ background: "#fff", border: "1px solid #d4ece4", borderRadius: 10,
                    padding: 24, marginBottom: 16 }}>
        <Bar w={180} h={13} mb={18} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Bar w="100%" h={72} mb={0} />
          <Bar w="100%" h={72} mb={0} />
          <Bar w="100%" h={72} mb={0} />
        </div>
      </div>

      {/* Card 3 */}
      <div style={{ background: "#fff", border: "1px solid #d4ece4", borderRadius: 10,
                    padding: 24 }}>
        <Bar w={160} h={13} mb={18} />
        <Bar w="100%" h={14} mb={10} />
        <Bar w="60%"  h={14} mb={0} />
      </div>
    </div>
  );
}
