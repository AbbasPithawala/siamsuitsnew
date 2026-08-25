import { BrowserRouter } from "react-router-dom";
import { AuthSessionProvider } from "./app/AuthSessionProvider";
import { AppRoutes } from "./routes/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <AuthSessionProvider>
        <AppRoutes />
      </AuthSessionProvider>
    </BrowserRouter>
  );
}

export default App;
