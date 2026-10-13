import { HashRouter, Route, Routes } from "react-router-dom";
import Home from "./components/Home";
import Sweater from "./components/Sweater";
import Project from "./components/Project";
import ScrollToTop from "./ScrollToTop";

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sweater/:sweaterId" element={<Sweater />} />
        <Route path="/project/:projectId" element={<Project view="overview" />} />
        <Route path="/project/:projectId/chart" element={<Project view="chart" />} />
      </Routes>
    </HashRouter>
  );
}
