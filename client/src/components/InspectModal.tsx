interface Props {
  title: string;
  subtitle?: string;
  body: string;
  onClose: () => void;
}

/** 카드/장비/캐릭터 능력 설명을 보여주는 간단한 모달 */
export function InspectModal({ title, subtitle, body, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal inspect" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {subtitle && <div className="inspect-sub">{subtitle}</div>}
        <p className="inspect-body">{body}</p>
        <button className="btn ghost" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
