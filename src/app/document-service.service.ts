import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface Document {
  id: number;
  id_usuario: number;
  nombre_documento: string;
  url_documento: string;
  fecha_subida: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'api/documentos';

  constructor(private http: HttpClient) {}

  getDocuments(userId: number): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/${userId}`);
  }

  uploadDocument(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl, formData);
  }
}
