import React, { forwardRef, useEffect, useRef, MutableRefObject, ComponentProps } from "react";
import { QRCodeCanvas } from "qrcode.react";

type QRProps = ComponentProps<typeof QRCodeCanvas>;

const QRCodeWithRef = forwardRef<HTMLDivElement, QRProps>((props, ref) => {
  const internalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(internalRef.current);
    } else if (ref) {
      (ref as MutableRefObject<HTMLDivElement | null>).current = internalRef.current;
    }
  }, [ref]);

  return (
    <div ref={internalRef}>
      <QRCodeCanvas {...props} />
    </div>
  );
});

QRCodeWithRef.displayName = "QRCodeWithRef"; // Add display name

export default QRCodeWithRef;
