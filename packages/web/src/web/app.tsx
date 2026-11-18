import { Route, Switch } from "wouter";
import Shop from "./pages/shop";
import ResetPassword from "./pages/reset-password";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";
function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/" component={Shop} />
        <Route path="/collection" component={Shop} />
        <Route path="/bazaar" component={Shop} />
        <Route path="/clans" component={Shop} />
        <Route path="/casino" component={Shop} />
        <Route path="/rewards" component={Shop} />
        <Route path="/chat" component={Shop} />
        <Route path="/profile" component={Shop} />
        <Route component={Shop} />
      </Switch>
      {import.meta.env.DEV && <AgentFeedback />}
      <RunableBadge />
    </Provider>
  );
}
export default App;
