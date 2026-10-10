import { Link } from "react-router-dom";
import HowItWorks from "../../components/HowItWorks";
import Icon from "../../components/Icon";

export default function GuidePage() {
  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Getting started</p>
          <h1>From idea to published campaign</h1>
          <p className="dash-page-lede">
            Four simple steps to create your next video campaign, with you in control at every stage.
          </p>
        </div>
      </header>
      <HowItWorks compact />
      <section className="panel guide-banner">
        <span className="guide-banner-icon"><Icon name="shield" size={25} /></span>
        <div>
          <h2>Your approval comes first</h2>
          <p>Review the video and caption in Telegram. Nothing is published until you approve the campaign.</p>
        </div>
        <Link className="primary-btn" to="/dashboard/compose">Create your campaign <Icon name="arrow-right" size={17} /></Link>
      </section>
    </div>
  );
}
