import { BrowserRouter, Routes, Route } from "react-router-dom";

import Step1_EmailPassword from "../pages/Registration/Step1_EmailPassword";
import Step2_NameUpload from "../pages/Registration/Step2_NameUpload";
import Step3_Wallet from "../pages/Registration/Step3_Wallet";

import AdminPage from "../pages/Admin/AdminPage";
import ClaimPage from "../pages/Claim/ClaimPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Registration steps */}
        <Route path="/" element={<Step1_EmailPassword />} />
        <Route path="/register/step1" element={<Step1_EmailPassword />} />
        <Route path="/register/step2" element={<Step2_NameUpload />} />
        <Route path="/register/step3" element={<Step3_Wallet />} />

        {/* Other pages */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/claim" element={<ClaimPage />} />
      </Routes>
    </BrowserRouter>
  );
}
