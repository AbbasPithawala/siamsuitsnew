import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { baseApi } from "./api/baseApi";
import authReducer from "./features/auth/authSlice";
import App from "./App";

function buildStore() {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

describe("App", () => {
  it("renders the login page when logged out", () => {
    render(
      <Provider store={buildStore()}>
        <App />
      </Provider>
    );
    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
  });
});
