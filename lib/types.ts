interface FileState {
  error?: string;
  file: File;
  progress: number;
  status: "idle" | "uploading" | "error" | "success";
}

interface StoreState {
  dragOver: boolean;
  files: Map<File, FileState>;
  invalid: boolean;
}

type StoreAction =
  | { type: "ADD_FILES"; files: File[] }
  | { type: "SET_FILES"; files: File[] }
  | { type: "SET_PROGRESS"; file: File; progress: number }
  | { type: "SET_SUCCESS"; file: File }
  | { type: "SET_ERROR"; file: File; error: string }
  | { type: "REMOVE_FILE"; file: File }
  | { type: "SET_DRAG_OVER"; dragOver: boolean }
  | { type: "SET_INVALID"; invalid: boolean }
  | { type: "CLEAR" };

interface Store {
  dispatch: (action: StoreAction) => void;
  getState: () => StoreState;
  subscribe: (listener: () => void) => () => void;
}

export type { FileState, Store, StoreAction, StoreState };
