"use client";

import {
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileCogIcon,
  FileIcon,
  FileTextIcon,
  FileVideoIcon,
} from "lucide-react";
import {
  Direction as DirectionPrimitive,
  Slot as SlotPrimitive,
} from "radix-ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useAsRef } from "@/hooks/use-as-ref";
import { useLazyRef } from "@/hooks/use-lazy-ref";
import type { FileState, Store, StoreAction, StoreState } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROOT_NAME = "FileUpload";
const DROPZONE_NAME = "FileUploadDropzone";
const TRIGGER_NAME = "FileUploadTrigger";
const LIST_NAME = "FileUploadList";
const ITEM_NAME = "FileUploadItem";
const ITEM_PREVIEW_NAME = "FileUploadItemPreview";
const ITEM_METADATA_NAME = "FileUploadItemMetadata";
const ITEM_PROGRESS_NAME = "FileUploadItemProgress";
const ITEM_DELETE_NAME = "FileUploadItemDelete";
const CLEAR_NAME = "FileUploadClear";

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`;
}

function getFileIcon(file: File) {
  const type = file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (type.startsWith("video/")) {
    return <FileVideoIcon />;
  }

  if (type.startsWith("audio/")) {
    return <FileAudioIcon />;
  }

  if (
    type.startsWith("text/") ||
    ["txt", "md", "rtf", "pdf"].includes(extension)
  ) {
    return <FileTextIcon />;
  }

  if (
    [
      "html",
      "css",
      "js",
      "jsx",
      "ts",
      "tsx",
      "json",
      "xml",
      "php",
      "py",
      "rb",
      "java",
      "c",
      "cpp",
      "cs",
    ].includes(extension)
  ) {
    return <FileCodeIcon />;
  }

  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(extension)) {
    return <FileArchiveIcon />;
  }

  if (
    ["exe", "msi", "app", "apk", "deb", "rpm"].includes(extension) ||
    type.startsWith("application/")
  ) {
    return <FileCogIcon />;
  }

  return <FileIcon />;
}

type Direction = "ltr" | "rtl";

const StoreContext = createContext<Store | null>(null);

function useStoreContext(consumerName: string) {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

function useStore<T>(selector: (state: StoreState) => T): T {
  const store = useStoreContext("useStore");

  const lastValueRef = useLazyRef<{ value: T; state: StoreState } | null>(
    () => null
  );

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const prevValue = lastValueRef.current;

    if (prevValue && prevValue.state === state) {
      return prevValue.value;
    }

    const nextValue = selector(state);
    lastValueRef.current = { value: nextValue, state };
    return nextValue;
  }, [store, selector, lastValueRef]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

interface FileUploadContextValue {
  dir: Direction;
  disabled: boolean;
  dropzoneId: string;
  inputId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  labelId: string;
  listId: string;
  urlCache: WeakMap<File, string>;
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null);

function useFileUploadContext(consumerName: string) {
  const context = useContext(FileUploadContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

interface FileUploadProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  accept?: string;
  asChild?: boolean;
  defaultValue?: File[];
  dir?: Direction;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  name?: string;
  onAccept?: (files: File[]) => void;
  onFileAccept?: (file: File) => void;
  onFileReject?: (file: File, message: string) => void;
  onFileValidate?: (file: File) => string | null | undefined;
  onUpload?: (
    files: File[],
    options: {
      onProgress: (file: File, progress: number) => void;
      onSuccess: (file: File) => void;
      onError: (file: File, error: Error) => void;
    }
  ) => Promise<void> | void;
  onValueChange?: (files: File[]) => void;
  required?: boolean;
  value?: File[];
}

function FileUpload(props: FileUploadProps) {
  const {
    value,
    defaultValue,
    onValueChange,
    onAccept,
    onFileAccept,
    onFileReject,
    onFileValidate,
    onUpload,
    accept,
    maxFiles,
    maxSize,
    dir: dirProp,
    label,
    name,
    asChild,
    disabled = false,
    invalid = false,
    multiple = false,
    required = false,
    children,
    className,
    ...rootProps
  } = props;

  const inputId = useId();
  const dropzoneId = useId();
  const listId = useId();
  const labelId = useId();

  const dir = DirectionPrimitive.useDirection(dirProp);
  const listeners = useLazyRef(() => new Set<() => void>()).current;
  const files = useLazyRef<Map<File, FileState>>(() => new Map()).current;
  const urlCache = useLazyRef(() => new WeakMap<File, string>()).current;
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;

  const propsRef = useAsRef({
    onValueChange,
    onAccept,
    onFileAccept,
    onFileReject,
    onFileValidate,
    onUpload,
  });

  const store = useMemo<Store>(() => {
    let state: StoreState = {
      files,
      dragOver: false,
      invalid,
    };

    function reducer(state: StoreState, action: StoreAction): StoreState {
      switch (action.type) {
        case "ADD_FILES": {
          for (const file of action.files) {
            files.set(file, {
              file,
              progress: 0,
              status: "idle",
            });
          }

          if (propsRef.current.onValueChange) {
            const fileList = Array.from(files.values()).map(
              (fileState) => fileState.file
            );
            propsRef.current.onValueChange(fileList);
          }
          return { ...state, files };
        }

        case "SET_FILES": {
          const newFileSet = new Set(action.files);
          for (const existingFile of files.keys()) {
            if (!newFileSet.has(existingFile)) {
              files.delete(existingFile);
            }
          }

          for (const file of action.files) {
            const existingState = files.get(file);
            if (!existingState) {
              files.set(file, {
                file,
                progress: 0,
                status: "idle",
              });
            }
          }
          return { ...state, files };
        }

        case "SET_PROGRESS": {
          const fileState = files.get(action.file);
          if (fileState) {
            files.set(action.file, {
              ...fileState,
              progress: action.progress,
              status: "uploading",
            });
          }
          return { ...state, files };
        }

        case "SET_SUCCESS": {
          const fileState = files.get(action.file);
          if (fileState) {
            files.set(action.file, {
              ...fileState,
              progress: 100,
              status: "success",
            });
          }
          return { ...state, files };
        }

        case "SET_ERROR": {
          const fileState = files.get(action.file);
          if (fileState) {
            files.set(action.file, {
              ...fileState,
              error: action.error,
              status: "error",
            });
          }
          return { ...state, files };
        }

        case "REMOVE_FILE": {
          const cachedUrl = urlCache.get(action.file);
          if (cachedUrl) {
            URL.revokeObjectURL(cachedUrl);
            urlCache.delete(action.file);
          }

          files.delete(action.file);

          if (propsRef.current.onValueChange) {
            const fileList = Array.from(files.values()).map(
              (fileState) => fileState.file
            );
            propsRef.current.onValueChange(fileList);
          }
          return { ...state, files };
        }

        case "SET_DRAG_OVER": {
          return { ...state, dragOver: action.dragOver };
        }

        case "SET_INVALID": {
          return { ...state, invalid: action.invalid };
        }

        case "CLEAR": {
          for (const file of files.keys()) {
            const cachedUrl = urlCache.get(file);
            if (cachedUrl) {
              URL.revokeObjectURL(cachedUrl);
              urlCache.delete(file);
            }
          }

          files.clear();
          if (propsRef.current.onValueChange) {
            propsRef.current.onValueChange([]);
          }
          return { ...state, files, invalid: false };
        }

        default:
          return state;
      }
    }

    return {
      getState: () => state,
      dispatch: (action) => {
        state = reducer(state, action);
        for (const listener of listeners) {
          listener();
        }
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }, [listeners, files, invalid, propsRef, urlCache]);

  const acceptTypes = useMemo(
    () => accept?.split(",").map((t) => t.trim()) ?? null,
    [accept]
  );

  const onProgress = useLazyRef(() => {
    let frame = 0;
    return (file: File, progress: number) => {
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        store.dispatch({
          type: "SET_PROGRESS",
          file,
          progress: Math.min(Math.max(0, progress), 100),
        });
      });
    };
  }).current;

  useEffect(() => {
    if (isControlled) {
      store.dispatch({ type: "SET_FILES", files: value });
    } else if (
      defaultValue &&
      defaultValue.length > 0 &&
      !store.getState().files.size
    ) {
      store.dispatch({ type: "SET_FILES", files: defaultValue });
    }
  }, [value, defaultValue, isControlled, store]);

  useEffect(
    () => () => {
      for (const file of files.keys()) {
        const cachedUrl = urlCache.get(file);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
        }
      }
    },
    [files, urlCache]
  );

  const onFilesUpload = useCallback(
    async (files: File[]) => {
      try {
        for (const file of files) {
          store.dispatch({ type: "SET_PROGRESS", file, progress: 0 });
        }

        if (propsRef.current.onUpload) {
          await propsRef.current.onUpload(files, {
            onProgress,
            onSuccess: (file) => {
              store.dispatch({ type: "SET_SUCCESS", file });
            },
            onError: (file, error) => {
              store.dispatch({
                type: "SET_ERROR",
                file,
                error: error.message ?? "Upload failed",
              });
            },
          });
        } else {
          for (const file of files) {
            store.dispatch({ type: "SET_SUCCESS", file });
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        for (const file of files) {
          store.dispatch({
            type: "SET_ERROR",
            file,
            error: errorMessage,
          });
        }
      }
    },
    [store, propsRef, onProgress]
  );

  const onFilesChange = useCallback(
    (originalFiles: File[]) => {
      if (disabled) {
        return;
      }

      let filesToProcess = [...originalFiles];
      let invalid = false;

      if (maxFiles) {
        const currentCount = store.getState().files.size;
        const remainingSlotCount = Math.max(0, maxFiles - currentCount);

        if (remainingSlotCount < filesToProcess.length) {
          const rejectedFiles = filesToProcess.slice(remainingSlotCount);
          invalid = true;

          filesToProcess = filesToProcess.slice(0, remainingSlotCount);

          for (const file of rejectedFiles) {
            let rejectionMessage = `Maximum ${maxFiles} files allowed`;

            if (propsRef.current.onFileValidate) {
              const validationMessage = propsRef.current.onFileValidate(file);
              if (validationMessage) {
                rejectionMessage = validationMessage;
              }
            }

            propsRef.current.onFileReject?.(file, rejectionMessage);
          }
        }
      }

      const acceptedFiles: File[] = [];
      const rejectedFiles: { file: File; message: string }[] = [];

      for (const file of filesToProcess) {
        let rejected = false;
        let rejectionMessage = "";

        if (propsRef.current.onFileValidate) {
          const validationMessage = propsRef.current.onFileValidate(file);
          if (validationMessage) {
            rejectionMessage = validationMessage;
            propsRef.current.onFileReject?.(file, rejectionMessage);
            rejected = true;
            invalid = true;
            continue;
          }
        }

        if (acceptTypes) {
          const fileType = file.type;
          const fileExtension = `.${file.name.split(".").pop()}`;

          if (
            !acceptTypes.some(
              (type) =>
                type === fileType ||
                type === fileExtension ||
                (type.includes("/*") &&
                  fileType.startsWith(type.replace("/*", "/")))
            )
          ) {
            rejectionMessage = "File type not accepted";
            propsRef.current.onFileReject?.(file, rejectionMessage);
            rejected = true;
            invalid = true;
          }
        }

        if (maxSize && file.size > maxSize) {
          rejectionMessage = "File too large";
          propsRef.current.onFileReject?.(file, rejectionMessage);
          rejected = true;
          invalid = true;
        }

        if (rejected) {
          rejectedFiles.push({ file, message: rejectionMessage });
        } else {
          acceptedFiles.push(file);
        }
      }

      if (invalid) {
        store.dispatch({ type: "SET_INVALID", invalid });
        setTimeout(() => {
          store.dispatch({ type: "SET_INVALID", invalid: false });
        }, 2000);
      }

      if (acceptedFiles.length > 0) {
        store.dispatch({ type: "ADD_FILES", files: acceptedFiles });

        if (isControlled && propsRef.current.onValueChange) {
          const currentFiles = Array.from(store.getState().files.values()).map(
            (f) => f.file
          );
          propsRef.current.onValueChange([...currentFiles]);
        }

        if (propsRef.current.onAccept) {
          propsRef.current.onAccept(acceptedFiles);
        }

        for (const file of acceptedFiles) {
          propsRef.current.onFileAccept?.(file);
        }

        if (propsRef.current.onUpload) {
          requestAnimationFrame(() => {
            onFilesUpload(acceptedFiles);
          });
        }
      }
    },
    [
      store,
      isControlled,
      propsRef,
      onFilesUpload,
      maxFiles,
      acceptTypes,
      maxSize,
      disabled,
    ]
  );

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      onFilesChange(files);
      event.target.value = "";
    },
    [onFilesChange]
  );

  const contextValue = useMemo<FileUploadContextValue>(
    () => ({
      dropzoneId,
      inputId,
      listId,
      labelId,
      dir,
      disabled,
      inputRef,
      urlCache,
    }),
    [dropzoneId, inputId, listId, labelId, dir, disabled, urlCache]
  );

  const RootPrimitive = asChild ? SlotPrimitive.Slot : "div";

  return (
    <StoreContext.Provider value={store}>
      <FileUploadContext.Provider value={contextValue}>
        <RootPrimitive
          data-disabled={disabled ? "" : undefined}
          data-slot="file-upload"
          dir={dir}
          {...rootProps}
          className={cn("relative flex flex-col gap-2", className)}
        >
          {children}
          <input
            accept={accept}
            aria-describedby={dropzoneId}
            aria-labelledby={labelId}
            className="sr-only"
            disabled={disabled}
            id={inputId}
            multiple={multiple}
            name={name}
            onChange={onInputChange}
            ref={inputRef}
            required={required}
            tabIndex={-1}
            type="file"
          />
          <div className="sr-only" id={labelId}>
            {label ?? "File upload"}
          </div>
        </RootPrimitive>
      </FileUploadContext.Provider>
    </StoreContext.Provider>
  );
}

interface FileUploadDropzoneProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
}

function FileUploadDropzone(props: FileUploadDropzoneProps) {
  const {
    asChild,
    className,
    onClick: onClickProp,
    onDragOver: onDragOverProp,
    onDragEnter: onDragEnterProp,
    onDragLeave: onDragLeaveProp,
    onDrop: onDropProp,
    onPaste: onPasteProp,
    onKeyDown: onKeyDownProp,
    ...dropzoneProps
  } = props;

  const context = useFileUploadContext(DROPZONE_NAME);
  const store = useStoreContext(DROPZONE_NAME);
  const dragOver = useStore((state) => state.dragOver);
  const invalid = useStore((state) => state.invalid);

  const propsRef = useAsRef({
    onClick: onClickProp,
    onDragOver: onDragOverProp,
    onDragEnter: onDragEnterProp,
    onDragLeave: onDragLeaveProp,
    onDrop: onDropProp,
    onPaste: onPasteProp,
    onKeyDown: onKeyDownProp,
  });

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      propsRef.current.onClick?.(event);

      if (event.defaultPrevented) {
        return;
      }

      const target = event.target;

      const isFromTrigger =
        target instanceof HTMLElement &&
        target.closest('[data-slot="file-upload-trigger"]');

      if (!isFromTrigger) {
        context.inputRef.current?.click();
      }
    },
    [context.inputRef, propsRef]
  );

  const onDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragOver?.(event);

      if (event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: true });
    },
    [store, propsRef]
  );

  const onDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragEnter?.(event);

      if (event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: true });
    },
    [store, propsRef]
  );

  const onDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragLeave?.(event);

      if (event.defaultPrevented) {
        return;
      }

      const relatedTarget = event.relatedTarget;
      if (
        relatedTarget &&
        relatedTarget instanceof Node &&
        event.currentTarget.contains(relatedTarget)
      ) {
        return;
      }

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: false });
    },
    [store, propsRef]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDrop?.(event);

      if (event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: false });

      const files = Array.from(event.dataTransfer.files);
      const inputElement = context.inputRef.current;
      if (!inputElement) {
        return;
      }

      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }

      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [store, context.inputRef, propsRef]
  );

  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      propsRef.current.onPaste?.(event);

      if (event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: false });

      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const files: File[] = [];
      for (const item of items) {
        if (item?.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length === 0) {
        return;
      }

      const inputElement = context.inputRef.current;
      if (!inputElement) {
        return;
      }

      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }

      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [store, context.inputRef, propsRef]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      propsRef.current.onKeyDown?.(event);

      if (
        !event.defaultPrevented &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        context.inputRef.current?.click();
      }
    },
    [context.inputRef, propsRef]
  );

  const DropzonePrimitive = asChild ? SlotPrimitive.Slot : "div";

  return (
    <DropzonePrimitive
      aria-controls={`${context.inputId} ${context.listId}`}
      aria-disabled={context.disabled}
      aria-invalid={invalid}
      data-disabled={context.disabled ? "" : undefined}
      data-dragging={dragOver ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      data-slot="file-upload-dropzone"
      dir={context.dir}
      id={context.dropzoneId}
      role="region"
      tabIndex={context.disabled ? undefined : 0}
      {...dropzoneProps}
      className={cn(
        "relative flex select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 outline-none transition-colors hover:bg-accent/30 focus-visible:border-ring/50 data-disabled:pointer-events-none data-dragging:border-primary/30 data-invalid:border-destructive data-dragging:bg-accent/30 data-invalid:ring-destructive/20",
        className
      )}
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
}

interface FileUploadTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

function FileUploadTrigger(props: FileUploadTriggerProps) {
  const { asChild, onClick: onClickProp, ...triggerProps } = props;

  const context = useFileUploadContext(TRIGGER_NAME);

  const propsRef = useAsRef({
    onClick: onClickProp,
  });

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      propsRef.current.onClick?.(event);

      if (event.defaultPrevented) {
        return;
      }

      context.inputRef.current?.click();
    },
    [context.inputRef, propsRef]
  );

  const TriggerPrimitive = asChild ? SlotPrimitive.Slot : "button";

  return (
    <TriggerPrimitive
      aria-controls={context.inputId}
      data-disabled={context.disabled ? "" : undefined}
      data-slot="file-upload-trigger"
      type="button"
      {...triggerProps}
      disabled={context.disabled}
      onClick={onClick}
    />
  );
}

interface FileUploadListProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
  forceMount?: boolean;
  orientation?: "horizontal" | "vertical";
}

function FileUploadList(props: FileUploadListProps) {
  const {
    className,
    orientation = "vertical",
    asChild,
    forceMount,
    ...listProps
  } = props;

  const context = useFileUploadContext(LIST_NAME);
  const fileCount = useStore((state) => state.files.size);
  const shouldRender = forceMount || fileCount > 0;

  if (!shouldRender) {
    return null;
  }

  const ListPrimitive = asChild ? SlotPrimitive.Slot : "div";

  return (
    <ListPrimitive
      aria-orientation={orientation}
      data-orientation={orientation}
      data-slot="file-upload-list"
      data-state={shouldRender ? "active" : "inactive"}
      dir={context.dir}
      id={context.listId}
      role="list"
      {...listProps}
      className={cn(
        "data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:slide-out-to-top-2 data-[state=active]:slide-in-from-top-2 flex flex-col gap-2 data-[state=active]:animate-in data-[state=inactive]:animate-out",
        orientation === "horizontal" && "flex-row overflow-x-auto p-1.5",
        className
      )}
    />
  );
}

interface FileUploadItemContextValue {
  fileState: FileState | undefined;
  id: string;
  messageId: string;
  nameId: string;
  sizeId: string;
  statusId: string;
}

const FileUploadItemContext = createContext<FileUploadItemContextValue | null>(
  null
);

function useFileUploadItemContext(consumerName: string) {
  const context = useContext(FileUploadItemContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ITEM_NAME}\``);
  }
  return context;
}

interface FileUploadItemProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
  value: File;
}

function FileUploadItem(props: FileUploadItemProps) {
  const { value, asChild, className, ...itemProps } = props;

  const id = useId();
  const statusId = `${id}-status`;
  const nameId = `${id}-name`;
  const sizeId = `${id}-size`;
  const messageId = `${id}-message`;

  const context = useFileUploadContext(ITEM_NAME);
  const fileState = useStore((state) => state.files.get(value));
  const fileCount = useStore((state) => state.files.size);
  const fileIndex = useStore((state) => {
    const files = Array.from(state.files.keys());
    return files.indexOf(value) + 1;
  });

  const itemContext = useMemo(
    () => ({
      id,
      fileState,
      nameId,
      sizeId,
      statusId,
      messageId,
    }),
    [id, fileState, statusId, nameId, sizeId, messageId]
  );

  if (!fileState) {
    return null;
  }

  let statusText: string;
  if (fileState.error) {
    statusText = `Error: ${fileState.error}`;
  } else if (fileState.status === "uploading") {
    statusText = `Uploading: ${fileState.progress}% complete`;
  } else if (fileState.status === "success") {
    statusText = "Upload complete";
  } else {
    statusText = "Ready to upload";
  }

  const ItemPrimitive = asChild ? SlotPrimitive.Slot : "div";

  return (
    <FileUploadItemContext.Provider value={itemContext}>
      <ItemPrimitive
        aria-describedby={`${nameId} ${sizeId} ${statusId} ${
          fileState.error ? messageId : ""
        }`}
        aria-labelledby={nameId}
        aria-posinset={fileIndex}
        aria-setsize={fileCount}
        data-slot="file-upload-item"
        dir={context.dir}
        id={id}
        role="listitem"
        {...itemProps}
        className={cn(
          "relative flex items-center gap-2.5 rounded-md border p-3",
          className
        )}
      >
        {props.children}
        <span className="sr-only" id={statusId}>
          {statusText}
        </span>
      </ItemPrimitive>
    </FileUploadItemContext.Provider>
  );
}

interface FileUploadItemPreviewProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
  render?: (file: File, fallback: () => React.ReactNode) => React.ReactNode;
}

function FileUploadItemPreview(props: FileUploadItemPreviewProps) {
  const { render, asChild, children, className, ...previewProps } = props;

  const itemContext = useFileUploadItemContext(ITEM_PREVIEW_NAME);
  const context = useFileUploadContext(ITEM_PREVIEW_NAME);

  const getDefaultRender = useCallback(
    (file: File) => {
      if (itemContext.fileState?.file.type.startsWith("image/")) {
        let url = context.urlCache.get(file);
        if (!url) {
          url = URL.createObjectURL(file);
          context.urlCache.set(file, url);
        }

        return (
          // biome-ignore lint/performance/noImgElement: dynamic file URLs from user uploads don't work well with Next.js Image optimization
          // biome-ignore lint/correctness/useImageSize: dynamic file URLs from user uploads don't work well with Next.js Image optimization
          <img alt={file.name} className="size-full object-cover" src={url} />
        );
      }

      return getFileIcon(file);
    },
    [itemContext.fileState?.file.type, context.urlCache]
  );

  const onPreviewRender = useCallback(
    (file: File) => {
      if (render) {
        return render(file, () => getDefaultRender(file));
      }

      return getDefaultRender(file);
    },
    [render, getDefaultRender]
  );

  if (!itemContext.fileState) {
    return null;
  }

  const ItemPreviewPrimitive = asChild ? SlotPrimitive.Slot : "div";

  return (
    <ItemPreviewPrimitive
      aria-labelledby={itemContext.nameId}
      data-slot="file-upload-preview"
      {...previewProps}
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-accent/50 [&>svg]:size-10",
        className
      )}
    >
      {onPreviewRender(itemContext.fileState.file)}
      {children}
    </ItemPreviewPrimitive>
  );
}

interface FileUploadItemMetadataProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
  size?: "default" | "sm";
}

function FileUploadItemMetadata(props: FileUploadItemMetadataProps) {
  const {
    asChild,
    size = "default",
    children,
    className,
    ...metadataProps
  } = props;

  const context = useFileUploadContext(ITEM_METADATA_NAME);
  const itemContext = useFileUploadItemContext(ITEM_METADATA_NAME);

  if (!itemContext.fileState) {
    return null;
  }

  const ItemMetadataPrimitive = asChild ? SlotPrimitive.Slot : "div";

  return (
    <ItemMetadataPrimitive
      data-slot="file-upload-metadata"
      dir={context.dir}
      {...metadataProps}
      className={cn("flex min-w-0 flex-1 flex-col", className)}
    >
      {children ?? (
        <>
          <span
            className={cn(
              "truncate font-medium text-sm",
              size === "sm" && "font-normal text-[13px] leading-snug"
            )}
            id={itemContext.nameId}
          >
            {itemContext.fileState.file.name}
          </span>
          <span
            className={cn(
              "truncate text-muted-foreground text-xs",
              size === "sm" && "text-[11px] leading-snug"
            )}
            id={itemContext.sizeId}
          >
            {formatBytes(itemContext.fileState.file.size)}
          </span>
          {itemContext.fileState.error && (
            <span
              className="text-destructive text-xs"
              id={itemContext.messageId}
            >
              {itemContext.fileState.error}
            </span>
          )}
        </>
      )}
    </ItemMetadataPrimitive>
  );
}
interface FileUploadItemProgressProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
  forceMount?: boolean;
  size?: number;
  variant?: "linear" | "circular" | "fill";
}

function FileUploadItemProgress(props: FileUploadItemProgressProps) {
  const {
    variant = "linear",
    size = 40,
    asChild,
    forceMount,
    className,
    ...progressProps
  } = props;

  const itemContext = useFileUploadItemContext(ITEM_PROGRESS_NAME);

  if (!itemContext.fileState) {
    return null;
  }

  const shouldRender = forceMount || itemContext.fileState.progress !== 100;

  if (!shouldRender) {
    return null;
  }

  const ItemProgressPrimitive = asChild ? SlotPrimitive.Slot : "div";

  switch (variant) {
    case "circular": {
      const circumference = 2 * Math.PI * ((size - 4) / 2);
      const strokeDashoffset =
        circumference - (itemContext.fileState.progress / 100) * circumference;

      return (
        <ItemProgressPrimitive
          aria-labelledby={itemContext.nameId}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={itemContext.fileState.progress}
          aria-valuetext={`${itemContext.fileState.progress}%`}
          data-slot="file-upload-progress"
          role="progressbar"
          {...progressProps}
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            className
          )}
        >
          <svg
            className="-rotate-90 transform"
            fill="none"
            height={size}
            stroke="currentColor"
            viewBox={`0 0 ${size} ${size}`}
            width={size}
          >
            <title>Upload progress</title>
            <circle
              className="text-primary/20"
              cx={size / 2}
              cy={size / 2}
              r={(size - 4) / 2}
              strokeWidth="2"
            />
            <circle
              className="text-primary transition-[stroke-dashoffset] duration-300 ease-linear"
              cx={size / 2}
              cy={size / 2}
              r={(size - 4) / 2}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        </ItemProgressPrimitive>
      );
    }

    case "fill": {
      const progressPercentage = itemContext.fileState.progress;
      const topInset = 100 - progressPercentage;

      return (
        <ItemProgressPrimitive
          aria-labelledby={itemContext.nameId}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progressPercentage}
          aria-valuetext={`${progressPercentage}%`}
          data-slot="file-upload-progress"
          role="progressbar"
          {...progressProps}
          className={cn(
            "absolute inset-0 bg-primary/50 transition-[clip-path] duration-300 ease-linear",
            className
          )}
          style={{
            clipPath: `inset(${topInset}% 0% 0% 0%)`,
          }}
        />
      );
    }

    default:
      return (
        <ItemProgressPrimitive
          aria-labelledby={itemContext.nameId}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={itemContext.fileState.progress}
          aria-valuetext={`${itemContext.fileState.progress}%`}
          data-slot="file-upload-progress"
          role="progressbar"
          {...progressProps}
          className={cn(
            "relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20",
            className
          )}
        >
          <div
            className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-linear"
            style={{
              transform: `translateX(-${100 - itemContext.fileState.progress}%)`,
            }}
          />
        </ItemProgressPrimitive>
      );
  }
}

interface FileUploadItemDeleteProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

function FileUploadItemDelete(props: FileUploadItemDeleteProps) {
  const { asChild, onClick: onClickProp, ...deleteProps } = props;

  const store = useStoreContext(ITEM_DELETE_NAME);
  const itemContext = useFileUploadItemContext(ITEM_DELETE_NAME);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event);

      if (!itemContext.fileState || event.defaultPrevented) {
        return;
      }

      store.dispatch({
        type: "REMOVE_FILE",
        file: itemContext.fileState.file,
      });
    },
    [store, itemContext.fileState, onClickProp]
  );

  if (!itemContext.fileState) {
    return null;
  }

  const ItemDeletePrimitive = asChild ? SlotPrimitive.Slot : "button";

  return (
    <ItemDeletePrimitive
      aria-controls={itemContext.id}
      aria-describedby={itemContext.nameId}
      data-slot="file-upload-item-delete"
      type="button"
      {...deleteProps}
      onClick={onClick}
    />
  );
}

interface FileUploadClearProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
  forceMount?: boolean;
}

function FileUploadClear(props: FileUploadClearProps) {
  const {
    asChild,
    forceMount,
    disabled,
    onClick: onClickProp,
    ...clearProps
  } = props;

  const context = useFileUploadContext(CLEAR_NAME);
  const store = useStoreContext(CLEAR_NAME);
  const fileCount = useStore((state) => state.files.size);

  const isDisabled = disabled || context.disabled;

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event);

      if (event.defaultPrevented) {
        return;
      }

      store.dispatch({ type: "CLEAR" });
    },
    [store, onClickProp]
  );

  const shouldRender = forceMount || fileCount > 0;

  if (!shouldRender) {
    return null;
  }

  const ClearPrimitive = asChild ? SlotPrimitive.Slot : "button";

  return (
    <ClearPrimitive
      aria-controls={context.listId}
      data-disabled={isDisabled ? "" : undefined}
      data-slot="file-upload-clear"
      type="button"
      {...clearProps}
      disabled={isDisabled}
      onClick={onClick}
    />
  );
}

export {
  FileUpload,
  FileUploadClear,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  type FileUploadProps,
  FileUploadTrigger,
  useStore as useFileUpload,
};
