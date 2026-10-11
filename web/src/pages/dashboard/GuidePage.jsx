import HowItWorks from "../../components/HowItWorks";
import Icon from "../../components/Icon";
import { Button, PageHeader } from "../../components/ui";

export default function GuidePage() {
  return (
    <div className="dash-page">
      <PageHeader
        kicker="Getting started"
        title="From idea to published campaign"
        description="Four simple steps to create your next video campaign, with you in control at every stage."
      />
      <HowItWorks compact />
      <section className="panel guide-banner">
        <span className="guide-banner-icon"><Icon name="shield" size={25} /></span>
        <div>
          <h2>Your approval comes first</h2>
          <p>Review the video and caption in Telegram. Nothing is published until you approve the campaign.</p>
        </div>
        <Button to="/dashboard/compose" variant="primary" size="md" icon="arrow-right" iconPosition="end">
          Create your campaign
        </Button>
      </section>
    </div>
  );
}
