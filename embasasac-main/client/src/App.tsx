import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import EmbasaDashboard from "@/pages/embasa-dashboard";
import SacDashboard from "@/pages/sac-dashboard";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ 
  component: Component, 
  allowedUserTypes 
}: { 
  component: React.ComponentType; 
  allowedUserTypes: string[];
}) {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Redirect to="/" />;
  }
  
  if (!allowedUserTypes.includes(currentUser.userType)) {
    return <Redirect to="/" />;
  }
  
  return <Component />;
}

function Router() {
  const { currentUser } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {currentUser ? (
          <Redirect 
            to={
              currentUser.userType === "admin" 
                ? "/admin" 
                : currentUser.userType === "embasa" 
                  ? "/embasa" 
                  : "/sac"
            } 
          />
        ) : (
          <Login />
        )}
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute 
          component={AdminDashboard} 
          allowedUserTypes={["admin"]} 
        />
      </Route>
      
      <Route path="/embasa">
        <ProtectedRoute 
          component={EmbasaDashboard} 
          allowedUserTypes={["embasa"]} 
        />
      </Route>
      
      <Route path="/sac">
        <ProtectedRoute 
          component={SacDashboard} 
          allowedUserTypes={["sac"]} 
        />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
