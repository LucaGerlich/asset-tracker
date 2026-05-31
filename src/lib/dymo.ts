/**
 * DYMO Connect Framework integration.
 * The SDK communicates with the DYMO Connect desktop service at https://127.0.0.1:41951
 * and must only run in the browser.
 */

export interface DymoPrinter {
  name: string;
  printerType: "LabelWriterPrinter" | "TapePrinter";
  isConnected: boolean;
  isLocal: boolean;
  isTwinTurbo: boolean;
}

interface DymoLabel {
  setObjectText(objectName: string, text: string): void;
  isValidLabel(): boolean;
  print(
    printerName: string,
    printParamsXml?: string,
    labelSetXml?: string,
  ): void;
}

declare global {
  interface Window {
    dymo?: {
      label: {
        framework: {
          init(
            successCallback?: () => void,
            errorCallback?: (error: string) => void,
          ): void;
          getPrinters(): DymoPrinter[];
          openLabelXml(xml: string): DymoLabel;
        };
      };
    };
  }
}

// Cache the load promise so multiple callers await the same load
let sdkLoadPromise: Promise<void> | null = null;

export function loadDymoSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("DYMO SDK requires a browser environment"));
  }

  if (window.dymo?.label?.framework) {
    return Promise.resolve();
  }

  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendors/dymo.connect.framework.js";
    script.async = true;
    script.onload = () => {
      // init() connects to the local DYMO Connect service — required before getPrinters()
      window.dymo?.label?.framework?.init(
        () => resolve(),
        (err: string) => {
          sdkLoadPromise = null;
          reject(new Error(`DYMO init failed: ${err}`));
        },
      );
    };
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error("Failed to load DYMO SDK"));
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

export function getDymoPrinters(): DymoPrinter[] {
  try {
    return window.dymo?.label?.framework?.getPrinters() ?? [];
  } catch {
    return [];
  }
}

export function printDymoLabel(xml: string, printerName: string): void {
  const label = window.dymo?.label?.framework?.openLabelXml(xml);
  if (!label) throw new Error("DYMO SDK not loaded");
  label.print(printerName);
}
