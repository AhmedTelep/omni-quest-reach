import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
};

const ProjectContext = createContext<Ctx>({ projectId: null, setProjectId: () => {} });

const KEY = "selected_project_id";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(KEY);
    if (stored && stored !== "null") setProjectIdState(stored);
  }, []);

  const setProjectId = (id: string | null) => {
    setProjectIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    }
  };

  return (
    <ProjectContext.Provider value={{ projectId, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);