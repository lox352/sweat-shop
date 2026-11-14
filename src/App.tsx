import { Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import PageLayout from "./components/ui/PageLayout";
import KnittingBoundary from "./components/KnittingBoundary";
import Home from "./components/Home";
import Sweater from "./components/Sweater";
import Project from "./components/Project";
import ScrollToTop from "./ScrollToTop";

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      {/* A page waits here while the knitting it shows is fetched: see knitting/useSweater's useKnitting. */}
      <KnittingBoundary>
      <Suspense fallback={<PageLayout title="Sweat Shop" showTitle={false}><p className="quiet" role="status">Opening the pattern…</p></PageLayout>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sweater/:sweaterId" element={<Sweater />} />
        <Route path="/project/:projectId" element={<Project view="overview" />} />
        <Route path="/project/:projectId/chart" element={<Project view="chart" />} />
      </Routes>
      </Suspense>
      </KnittingBoundary>
    </HashRouter>
  );
}
