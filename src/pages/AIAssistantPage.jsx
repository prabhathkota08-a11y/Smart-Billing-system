import Layout from "../component/Layout";
import AIAssistant from "../component/AIAssistant";

function AIAssistantPage() {
  return (
    <Layout>
      <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", margin: "0 0 24px" }}>
        AI Assistant
      </h1>
      <AIAssistant embedded={true} />
    </Layout>
  );
}

export default AIAssistantPage;
