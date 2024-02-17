export interface DataError {
  errorMessage: string;
}

export function isDataError(obj: any): obj is DataError {
  return (
    typeof obj === "object" &&
    "errorMessage" in obj &&
    typeof obj.errorMessage === "string"
  );
}
