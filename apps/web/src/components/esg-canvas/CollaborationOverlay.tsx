import type { RemoteCursor, CommentPin } from "../../hooks/useCollaboration.js";

interface CollaborationOverlayProps {
  cursors:  Map<string, RemoteCursor>;
  comments: CommentPin[];
  myUserId: string | null;
}

export function CollaborationOverlay({ cursors, comments, myUserId }: CollaborationOverlayProps) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden" }}>
      {/* Uzak imleçler */}
      {[...cursors.values()]
        .filter(c => c.userId !== myUserId)
        .map(cursor => (
          <div
            key={cursor.userId}
            style={{
              position: "absolute",
              left: cursor.x,
              top:  cursor.y,
              transform: "translate(-2px, -2px)",
              transition: "left 60ms linear, top 60ms linear",
              pointerEvents: "none",
            }}
          >
            {/* İmleç ok */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>
              <path d="M0 0L0 14L4 10L7 18L9 17L6 9L11 9Z" fill={cursor.color} />
            </svg>
            {/* İsim etiketi */}
            <div style={{
              position: "absolute",
              top: 18, left: 8,
              background: cursor.color,
              color: "#fff",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}>
              {cursor.name}
            </div>
          </div>
        ))}

      {/* Yorum pin'leri */}
      {comments.map(pin => (
        <div
          key={pin.id}
          style={{
            position: "absolute",
            left: pin.x,
            top:  pin.y,
            transform: "translate(-8px, -8px)",
            pointerEvents: "none",
          }}
        >
          {/* Pin balonu */}
          <div style={{
            background: "#fef3c7",
            border: "1.5px solid #f59e0b",
            borderRadius: "12px 12px 12px 2px",
            padding: "5px 8px",
            fontSize: 11,
            maxWidth: 180,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            color: "#1e293b",
          }}>
            <div style={{ fontWeight: 700, fontSize: 10, color: "#92400e", marginBottom: 2 }}>{pin.name}</div>
            {pin.text}
          </div>
        </div>
      ))}
    </div>
  );
}
