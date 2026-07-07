import Slidebar from "./Slidebar";

function Layout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Slidebar />
      <main style={{ flex: 1, padding: "24px", background: "#f8fafc", marginLeft: "250px" }}>
        {children}
      </main>
    </div>
  );
}

export default Layout;
