# Spec-Driven Development: Evolução de DX do CoffeeMail SDK (@coffeemail/node)

- **Documento**: RFC / Spec Técnica de Evolução de Ergonomia e DX
- **Alvo**: `@coffeemail/node`
- **Versão Atual**: `0.1.4` (publicada no npm) / `0.1.6` (desenvolvimento local)
- **Versão Alvo da Spec**: `0.2.0` (Minor release semântica)
- **Status**: Ready for Implementation (Aprovado para Desenvolvimento)

---

## 1. Contexto e Motivação

Durante a construção do ambiente de homologação e workbench do CoffeeMail, foi realizada uma auditoria prática de consumo do SDK `@coffeemail/node` na perspectiva de um desenvolvedor integrador externo.

Identificou-se que, embora o padrão fundamental `{ data, error }` e o suporte a TypeScript sejam excelentes, existem **atritos e inconsistências de Developer Experience (DX)** que dificultam o uso fluido da biblioteca sem inspecionar os arquivos internos `.d.ts`:

1. **Inconsistência de Envelopes**: Alguns recursos retornam o nome da entidade no plural (`emails`, `domains`), enquanto outros retornam chave genérica `data` (`templates.list`).
2. **Fragmentação de Paginação**: Convívio de paginação por cursor (`after`/`nextCursor`), paginação por offset (`offset`/`limit`) e ausência total de paginação em listagens (`templates.list`).
3. **Ergonomia e Visibilidade de Sub-recursos**: Gestão de contatos aninhada exclusivamente em `audiences.contacts.*` sem atalhos diretos na interface do recurso principal.
4. **Assimetria entre Criação e Consulta**: `domains.create` não retorna campos essenciais como `createdAt`, exigindo chamadas adicionais imediatas.
5. **Gaps de Documentação**: O `README.md` publicado no npm cobre com código funcional apenas 25% da superfície da API (Emails e Webhooks), deixando Templates, Contatos, Audiências e Supressões desprovidos de exemplos rápidos.

---

## 2. Princípios de Design (Design Tenets)

- **Princípio da Menor Surpresa (POLA)**: O desenvolvedor que aprendeu a listar e filtrar e-mails deve intuir imediatamente como listar e filtrar modelos, domínios e supressões.
- **Previsibilidade de Nomes**: Listagens retornam sempre o nome do recurso no plural (`templates`, `emails`, `domains`, `audiences`, `suppressions`).
- **Retrocompatibilidade Gradual**: Nenhuma alteração de chave quebrará código existente em produção; getters legados com aviso de `@deprecated` garantirão transição suave.
- **Ergonomia First**: Disponibilizar atalhos intuitivos no cliente onde a ergonomia de digitação for superior.
- **Documentação Executável**: Todo recurso do SDK terá um exemplo de código funcional, copy-paste, no README oficial e no TSDoc.

---

## 3. Especificação Detalhada das Mudanças

### 3.1. Normalização do Envelope de Templates (`templates.list`)

#### Situação Atual:
```typescript
const { data, error } = await coffeemail.templates.list();
// data possui formato: { data: TemplateDetail[] }
// Acesso: data.data.map(...) ❌ (Redundante e anti-ergonômico)
```

#### Especificação Alvo:
```typescript
export interface ListTemplatesResponse {
  readonly templates: ReadonlyArray<TemplateDetail>;
  /**
   * @deprecated Utilize a propriedade `templates`. Mantido para retrocompatibilidade.
   */
  readonly data: ReadonlyArray<TemplateDetail>;
  readonly nextCursor?: string | null;
}
```
* **Assinatura de consulta**: Permitir query opcional `coffeemail.templates.list(query?: ListTemplatesQuery)` com parâmetros `limit` e `after`.

---

### 3.2. Normalização de Nomenclatura em Audiências (`audiences.list`)

#### Situação Atual:
```typescript
// Audiência retornada com 'contactsCount'
console.log(audience.contactsCount); // ❌ Inconsistente com 'total' ou 'totalContacts'
```

#### Especificação Alvo:
No tipo `AudienceDetail`:
```typescript
export interface AudienceDetail {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly totalContacts: number; // ✅ Padronizado
  /**
   * @deprecated Utilize `totalContacts`. Mantido para retrocompatibilidade.
   */
  readonly contactsCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

---

### 3.3. Atalhos Ergonômicos para Contatos em Audiências

#### Situação Atual:
Apenas acessível via `coffeemail.audiences.contacts.list(audienceId)`.

#### Especificação Alvo:
Adicionar métodos convenientes na classe `Audiences` que delegam para `this.contacts`:
```typescript
class Audiences {
  public readonly contacts: Contacts;

  // Atalhos ergonômicos diretos:
  public listContacts(audienceId: string, query?: OffsetPaginationQuery) {
    return this.contacts.list(audienceId, query);
  }

  public createContact(audienceId: string, payload: CreateContactPayload) {
    return this.contacts.create(audienceId, payload);
  }

  public bulkAddContacts(audienceId: string, payload: BulkAddContactsPayload) {
    return this.contacts.bulkAdd(audienceId, payload);
  }
}
```

---

### 3.4. Enriquecimento da Resposta de Criação de Domínio (`domains.create`)

#### Situação Atual:
`CreateDomainResponse` retorna apenas `{ id, name, status, dkimRecordsToPublish }`, omitindo `createdAt`.

#### Especificação Alvo:
Garantir que `CreateDomainResponse` contenha `createdAt: string` (gerado pelo servidor ou fallback de timestamp ISO), permitindo que o consumidor processe o domínio imediatamente sem disparar um `domains.get(id)`.

---

### 3.5. Simplificação de Assinatura em `templates.preview`

#### Situação Atual:
Exige payload bruto de HTML completo:
`coffeemail.templates.preview({ html: "...", format: "html" })`

#### Especificação Alvo:
Permitir renderizar prévia tanto por ID de modelo existente quanto por código bruto:
```typescript
// Sobrecarga 1 (por ID cadastrado):
coffeemail.templates.previewById(templateId: string, variables?: Record<string, unknown>);

// Sobrecarga 2 (por HTML bruto):
coffeemail.templates.preview({ html: "...", variables: { nome: "João" } });
```

---

## 4. Plano de Documentação e Exemplos no `README.md`

O `README.md` do pacote `@coffeemail/node` será reestruturado para conter seções completas de código para os 8 módulos principais:

| Recurso | Snippet de Exemplo no README | Cobertura de Parâmetros |
| :--- | :--- | :--- |
| **Emails** | Envio simples, Envio com anexo, Batch, Consulta e Cancelamento | `from`, `to`, `replyTo`, `attachments`, `tags` |
| **Domains** | Criação, Listagem e Checagem de DNS | `name`, leitura de `dkimRecordsToPublish` |
| **Templates** | Criação, Preview com variáveis e Renderização | `variables`, `format: 'html'`, `preview` |
| **Audiences** | Criação de audiência e cadastro individual e bulk de contatos | `contacts.create`, `bulkAdd` |
| **Broadcasts** | Criação de campanha e disparo com cancelamento | `audienceId`, `templateId`, `scheduledAt` |
| **Suppressions** | Consulta de e-mail e cadastro com motivos tipados | `manual`, `bounce`, `complaint` |
| **Webhooks** | Registro, listagem, teste e validação de HMAC | `verifySignature` com header e secret |
| **Stats** | Consulta de métricas agregadas por período | `period: 'last7d'`, `startDate`, `endDate` |

---

## 5. Roteiro de Execução (SDD Implementation Steps)

1. **Fase 1 (Tipagem e Contratos no SDK)**:
   - Atualizar `types/templates.types.ts`, `types/audiences.types.ts` e `types/domains.types.ts`.
   - Adicionar aliases com `@deprecated` para não quebrar consumidores existentes.
2. **Fase 2 (Implementação nos Resources)**:
   - Implementar atalhos em `resources/audiences.ts`.
   - Ajustar `resources/templates.ts` para retornar `{ templates, data }`.
   - Implementar método `previewById` em templates.
3. **Fase 3 (Testes Unitários de Regressão e Paridade)**:
   - Garantir que 100% dos testes existentes no SDK passem.
   - Adicionar testes cobrindo os atalhos e os novos envelopes.
4. **Fase 4 (Atualização do README e TSDoc)**:
   - Reescrever o README do pacote com todos os exemplos práticos.
5. **Fase 5 (Build, Bump de Versão e Publicação)**:
   - Atualizar versão no `package.json` para `0.2.0`.
   - Executar `pnpm run build:node` e publicar no npm.
6. **Fase 6 (Validação no Workbench)**:
   - Atualizar a dependência no workbench: `pnpm add @coffeemail/node@0.2.0`.
   - Executar todos os testes do workbench e validar a experiência do desenvolvedor.
