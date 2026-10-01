import type { HttpClient } from "../core/http-client.js";
import { toQueryParams } from "../core/query.js";
import type {
  CoffeeMailResponse,
  OffsetPaginationQuery,
} from "../core/types.js";
import type {
  AudienceDetail,
  BulkAddContactsPayload,
  BulkAddContactsResult,
  ContactDetail,
  CreateAudiencePayload,
  CreateContactPayload,
  ListAudiencesResponse,
  ListContactsResponse,
  UpdateAudiencePayload,
  UpdateAudienceResult,
  UpdateContactPayload,
  UpdateContactResult,
} from "../types/audiences.types.js";

export class Contacts {
  constructor(private readonly http: HttpClient) {}

  public async create(
    audienceId: string,
    payload: CreateContactPayload,
  ): Promise<CoffeeMailResponse<ContactDetail>> {
    return this.http.post<ContactDetail>(
      `/v1/product/audiences/${audienceId}/contacts`,
      payload,
    );
  }

  public async list(
    audienceId: string,
    query?: OffsetPaginationQuery,
  ): Promise<CoffeeMailResponse<ListContactsResponse>> {
    return this.http.get<ListContactsResponse>(
      `/v1/product/audiences/${audienceId}/contacts`,
      toQueryParams(query),
    );
  }

  /**
   * Adiciona até 10.000 contatos de uma vez a uma audiência.
   */
  public async bulkAdd(
    audienceId: string,
    payload: BulkAddContactsPayload,
  ): Promise<CoffeeMailResponse<BulkAddContactsResult>> {
    return this.http.post<BulkAddContactsResult>(
      `/v1/product/audiences/${audienceId}/contacts/bulk`,
      payload,
    );
  }

  public async update(
    audienceId: string,
    contactId: string,
    payload: UpdateContactPayload,
  ): Promise<CoffeeMailResponse<UpdateContactResult>> {
    return this.http.put<UpdateContactResult>(
      `/v1/product/audiences/${audienceId}/contacts/${contactId}`,
      payload,
    );
  }

  /**
   * Remove um contato da audiência. Não retorna corpo na resposta (204 No Content).
   */
  public async delete(
    audienceId: string,
    contactId: string,
  ): Promise<CoffeeMailResponse<void>> {
    return this.http.delete<void>(
      `/v1/product/audiences/${audienceId}/contacts/${contactId}`,
    );
  }
}

const normalizeAudience = (aud: AudienceDetail): AudienceDetail => {
  const count = aud.totalContacts ?? aud.contactsCount ?? 0;
  return {
    ...aud,
    totalContacts: count,
    contactsCount: count,
  };
};

export class Audiences {
  public readonly contacts: Contacts;

  constructor(private readonly http: HttpClient) {
    this.contacts = new Contacts(http);
  }

  public async create(
    payload: CreateAudiencePayload,
  ): Promise<CoffeeMailResponse<AudienceDetail>> {
    const response = await this.http.post<AudienceDetail>(
      "/v1/product/audiences",
      payload,
    );
    if (response.error) {
      return response;
    }
    return {
      data: normalizeAudience(response.data),
      error: null,
    };
  }

  public async list(
    query?: OffsetPaginationQuery,
  ): Promise<CoffeeMailResponse<ListAudiencesResponse>> {
    const response = await this.http.get<ListAudiencesResponse>(
      "/v1/product/audiences",
      toQueryParams(query),
    );
    if (response.error) {
      return response;
    }
    return {
      data: {
        total: response.data.total,
        audiences: response.data.audiences.map(normalizeAudience),
      },
      error: null,
    };
  }

  public async get(id: string): Promise<CoffeeMailResponse<AudienceDetail>> {
    const response = await this.http.get<AudienceDetail>(
      `/v1/product/audiences/${id}`,
    );
    if (response.error) {
      return response;
    }
    return {
      data: normalizeAudience(response.data),
      error: null,
    };
  }

  public async update(
    id: string,
    payload: UpdateAudiencePayload,
  ): Promise<CoffeeMailResponse<UpdateAudienceResult>> {
    return this.http.put<UpdateAudienceResult>(
      `/v1/product/audiences/${id}`,
      payload,
    );
  }

  /**
   * Remove a audiência e seus contatos. Não retorna corpo na resposta (204 No Content).
   */
  public async delete(id: string): Promise<CoffeeMailResponse<void>> {
    return this.http.delete<void>(`/v1/product/audiences/${id}`);
  }

  /**
   * Atalho ergonômico para listar contatos de uma audiência.
   * Equivalente a `coffeemail.audiences.contacts.list(audienceId, query)`.
   */
  public async listContacts(
    audienceId: string,
    query?: OffsetPaginationQuery,
  ): Promise<CoffeeMailResponse<ListContactsResponse>> {
    return this.contacts.list(audienceId, query);
  }

  /**
   * Atalho ergonômico para cadastrar um contato em uma audiência.
   * Equivalente a `coffeemail.audiences.contacts.create(audienceId, payload)`.
   */
  public async createContact(
    audienceId: string,
    payload: CreateContactPayload,
  ): Promise<CoffeeMailResponse<ContactDetail>> {
    return this.contacts.create(audienceId, payload);
  }

  /**
   * Atalho ergonômico para inserção de contatos em lote em uma audiência.
   * Equivalente a `coffeemail.audiences.contacts.bulkAdd(audienceId, payload)`.
   */
  public async bulkAddContacts(
    audienceId: string,
    payload: BulkAddContactsPayload,
  ): Promise<CoffeeMailResponse<BulkAddContactsResult>> {
    return this.contacts.bulkAdd(audienceId, payload);
  }
}
