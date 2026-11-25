/** Placeholder for a route whose page isn't built yet (Reports, Settings). Props: title */
import { Hourglass } from "lucide-react";

export default function ComingSoon({ title }) {
  return (
    <>
      <header>
        <h1>{title}</h1>
        <p className="text-secondary">This page is on its way.</p>
      </header>
      <div className="glass-card text-secondary text-center" style={{ padding: "48px 20px" }}>
        <Hourglass size={48} opacity={0.2} />
        <p style={{ margin: "12px 0 0" }}>{title} is coming soon.</p>
      </div>
    </>
  );
}
