// InstaCaps wordmark: two caption lines on an ink tile, then the name.
export default function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wordmark-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      InstaCaps
    </span>
  );
}
