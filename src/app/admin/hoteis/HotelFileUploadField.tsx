"use client";

type HotelFileUploadFieldProps = {
  accept: string;
  auxiliaryText: string;
  fileNames: string[];
  id: string;
  multiple?: boolean;
  onChange: (files: FileList | null) => void;
  title: string;
  disabled?: boolean;
  inputName?: string;
  required?: boolean;
};

export function HotelFileUploadField({
  accept,
  auxiliaryText,
  fileNames,
  id,
  multiple = false,
  onChange,
  title,
  disabled = false,
  inputName,
  required = false,
}: HotelFileUploadFieldProps) {
  const hasFiles = fileNames.length > 0;

  return (
    <label className="admin-file-upload">
      <input
        id={id}
        name={inputName}
        className="admin-file-upload-input"
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
        disabled={disabled}
        aria-label={title}
        onChange={(event) => onChange(event.target.files)}
      />
      <span className="admin-file-upload-trigger">
        <span className="admin-file-upload-trigger__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" />
          </svg>
        </span>
        <span className="admin-file-upload-trigger__content">
          <strong>{title}</strong>
          <small>{auxiliaryText}</small>
          <span className="admin-file-upload-trigger__meta" aria-live="polite">
            {hasFiles
              ? fileNames.length === 1
                ? fileNames[0]
                : `${fileNames.length} arquivos selecionados`
              : "Nenhum arquivo selecionado."}
          </span>
        </span>
      </span>
      {hasFiles && fileNames.length > 1 ? (
        <span className="admin-file-upload-list" aria-live="polite">
          {fileNames.join(", ")}
        </span>
      ) : null}
    </label>
  );
}
