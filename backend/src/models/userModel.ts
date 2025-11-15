export interface IUser {
  id: string;
  name: string;
  filePath: string;
  token: string | null;
}

// Einfaches In-Memory-Array für Users
export const User: IUser[] = [];
