import HowItWorks from "../../components/HowItWorks";
import Icon from "../../components/Icon";
import { Button } from "../../components/ui";

export default function GuidePage() {
  return (
    <div className="dash-page">
      <HowItWorks compact />
      <section className="panel guide-banner">
        <span className="guide-banner-icon"><Icon name="shield" size={25} /></span>
        <div>
          <h2>You approve before publish</h2>
          <p>Progress lives in Pipeline and History.</p>
        </div>
        <Button to="/dashboard/compose" variant="primary" size="sm" icon="arrow-right" iconPosition="end">
          Make a video
        </Button>
      </section>
    </div>
  );
}
