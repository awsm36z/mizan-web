import { ChatShell } from "@/components/ChatShell";
import { PortfolioPanel } from "@/components/PortfolioPanel";

export default function Page() {
  return (
    <>
      <ChatShell />
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: "0 20px 24px" }}>
        <PortfolioPanel />
      </div>
    </>
  );
}
