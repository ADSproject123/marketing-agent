import HowItWorks from "../../components/HowItWorks";

export default function GuidePage() {
  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Guide</p>
          <h1>How it works</h1>
          <p className="dash-page-lede">
            The dashboard starts jobs. Telegram is the only approval gate before publish.
          </p>
        </div>
      </header>
      <HowItWorks compact />
    </div>
  );
}
