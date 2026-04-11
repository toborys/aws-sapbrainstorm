# MASTER PROMPT NAPRAWCZY — Diagnostyka i naprawa niedziałającego systemu
> Wersja: 1.0
> Przeznaczenie: Naprawa istniejących systemów. NIE do budowania nowych.

---

## INSTRUKCJA KRYTYCZNA — PRZECZYTAJ ZANIM ZACZNIESZ

Ten prompt uruchamia sekwencję 5 agentów naprawczych.

**Każdy agent działa wyłącznie na podstawie tego co ZNAJDZIE w kodzie — nie na podstawie założeń.**

Jeśli architektura systemu różni się od jakichkolwiek wzorców opisanych w tym prompcie — to jest OCZEKIWANE. Agenci adaptują się do rzeczywistości, nie odrzucają zadania.

**ZAKAZ:** Żaden agent NIE może stwierdzić "to nie pasuje do architektury" i przerwać pracę. Zamiast tego: opisz faktyczną architekturę i kontynuuj diagnozę w jej kontekście.

---

## SEKCJA 0 — OPIS PROBLEMU (wypełnij przed uruchomieniem)

```
[OBJAWY — co nie działa z perspektywy użytkownika]
Przykład: "Dodaję serwis do kontraktu, formularz potwierdza zapisanie,
ale liczba godzin na kontrakcie się nie zmienia."

[KROKI REPRODUKCJI — jak wywołać błąd]
Przykład:
1. Wejdź na /contracts
2. Otwórz kontrakt ID: xxx
3. Kliknij "Dodaj serwis", wypełnij formularz, zatwierdź
4. Wróć do kontraktu — remaining_hours bez zmian

[OCZEKIWANE ZACHOWANIE]
Przykład: "Po dodaniu serwisu: used_hours wzrasta o wpisane godziny,
remaining_hours maleje o tę samą wartość"

[FAKTYCZNE ZACHOWANIE]
Przykład: "used_hours = 0, remaining_hours = wartość pierwotna"

[CO JUŻ PRÓBOWAŁEŚ]
Przykład: "Sprawdziłem że formularz wysyła request — widzę go w Network tab.
Response 200. Ale baza nie jest zaktualizowana."

[DOSTĘP DO KODU]
Wklej tutaj: pełne pliki lub fragmenty które uważasz za istotne.
Jeśli nie wiesz które — wklej strukturę projektu (ls -la lub tree).
```

---

## ══════════════════════════════════════════════════
## AGENT 1 — DISCOVERY
## Cel: Zrozumieć system zanim cokolwiek zostanie zmienione
## ══════════════════════════════════════════════════

### Instrukcja dla agenta:

Twoim jedynym zadaniem w tej fazie jest CZYTANIE i MAPOWANIE. Nie sugerujesz napraw. Nie oceniasz jakości kodu. Nie porównujesz do wzorców.

**KROK 1.1 — Zmapuj stack technologiczny**

Na podstawie dostępnego kodu odpowiedz na każde pytanie:

```
STACK DISCOVERY:
□ Frontend framework: _____________ (React / Next.js / Vue / Angular / inne)
□ State management:  _____________ (TanStack Query / Redux / Zustand / SWR / useState / inne)
□ Backend framework: _____________ (NestJS / Express / Next.js API / FastAPI / inne)
□ ORM / Query builder: ___________ (Prisma / TypeORM / Drizzle / Sequelize / raw SQL / inne)
□ Baza danych:       _____________ (PostgreSQL / MySQL / SQLite / DynamoDB / MongoDB / inne)
□ Auth:              _____________ (NextAuth / Cognito / Clerk / custom JWT / inne)
□ Transport API:     _____________ (REST / GraphQL / tRPC / gRPC / inne)
□ Deploy:            _____________ (AWS / Vercel / Railway / lokalnie / inne)
```

**KROK 1.2 — Zmapuj model danych**

Znajdź i wypisz schemat bazy danych (Prisma schema, TypeORM entities, SQL DDL lub cokolwiek istnieje):

```
ENCJE I POLA:
[Wypisz każdą encję z polami — zwłaszcza pola które mogą być "licznikami" lub "polami pochodnymi"]

RELACJE:
[Wypisz relacje między encjami z kardynalnością]

POLA POCHODNE / LICZNIKI:
[Zidentyfikuj pola które POWINNY być wyliczane z innych encji, np. used_hours, total_amount, status]
[Zaznacz: czy są obliczane w bazie (computed column / trigger) czy w kodzie aplikacji?]
```

**KROK 1.3 — Zmapuj przepływ operacji której dotyczy błąd**

Śledź pełną ścieżkę operacji od UI do bazy:

```
PRZEPŁYW OPERACJI [nazwa operacji której dotyczy błąd]:

1. UI TRIGGER:
   Plik: _____________
   Funkcja/komponent: _____________
   Co wywołuje: _____________ (fetch / mutation / action)

2. API ENDPOINT:
   Metoda + ścieżka: _____________ (np. POST /api/service-logs)
   Plik: _____________
   Controller/Handler: _____________

3. WARSTWA SERWISU / LOGIKI:
   Plik: _____________
   Funkcja: _____________
   Co robi krok po kroku: [wypisz]

4. WARSTWA DANYCH:
   ORM query lub raw SQL: [wypisz dokładnie]
   Czy używa transakcji: TAK / NIE
   Jakie tabele/encje modyfikuje: [wypisz]

5. CO SIĘ DZIEJE Z POLAMI POCHODNYMI:
   Czy są aktualizowane w tej samej operacji: TAK / NIE / NIE WIEM
   Jeśli TAK — gdzie dokładnie w kodzie: _____________
   Jeśli NIE — czy jest osobny mechanizm (trigger, event, cron): _____________
```

**KROK 1.4 — Wynik fazy DISCOVERY**

Przed przejściem do DIAGNOSTICS wygeneruj podsumowanie:

```
=== DISCOVERY REPORT ===

Stack: [jedna linia opisu]

Encja której dotyczy błąd: [nazwa]
Pole które nie jest aktualizowane: [nazwa]
Miejsce gdzie POWINNO być aktualizowane: [plik + linia lub funkcja]
Miejsce gdzie FAKTYCZNIE jest lub nie jest aktualizowane: [plik + linia lub "nie znaleziono"]

Najważniejsze obserwacje:
1. ___________
2. ___________
3. ___________

Hipotezy wstępne (jeszcze bez diagnozy):
- ___________
========================
```

---

## ══════════════════════════════════════════════════
## AGENT 2 — DIAGNOSTICS
## Cel: Zlokalizować przyczynę, udowodnić hipotezę
## ══════════════════════════════════════════════════

### Instrukcja dla agenta:

Działasz wyłącznie na DISCOVERY REPORT i dostępnym kodzie. Nie zmieniasz nic. Stawiasz hipotezy i każdą z nich weryfikujesz dowodem z kodu.

**KROK 2.1 — Lista hipotez**

Dla każdego zgłoszonego objawu wygeneruj listę możliwych przyczyn:

```
HIPOTEZY (od najbardziej do najmniej prawdopodobnej):

H1: [opis hipotezy]
    Dowód za: [konkretne miejsce w kodzie które to sugeruje]
    Dowód przeciw: [co temu przeczy]
    Status: POTWIERDZONA / OBALONA / NIEROZSTRZYGNIĘTA

H2: [opis hipotezy]
    Dowód za: ___________
    Dowód przeciw: ___________
    Status: ___________

[kontynuuj dla każdej hipotezy]
```

**Katalog typowych przyczyn — sprawdź każdą:**

```
KATEGORIA A — Brakująca aktualizacja pola pochodnego:
□ Operacja zapisuje encję podrzędną ale NIE aktualizuje encji nadrzędnej
□ Aktualizacja encji nadrzędnej jest w kodzie ale warunkowana błędnym warunkiem
□ Aktualizacja jest w osobnej funkcji która nie jest wywoływana po operacji
□ Aktualizacja używa złego ID (np. bierze contractId z złego miejsca)

KATEGORIA B — Problem z transakcją / kolejnością:
□ Aktualizacja licznika odbywa się PRZED zapisem encji podrzędnej (race condition)
□ Operacja nie jest opakowana w transakcję — częściowy zapis przy błędzie
□ Transakcja jest ale rollback połyka błąd bez logowania
□ Optimistic update na frontendzie mija się z faktycznym stanem bazy

KATEGORIA C — Problem z query / ORM:
□ Query aktualizuje złe rekordy (brak WHERE lub zły WHERE)
□ Prisma / ORM zwraca stare dane z cache (brak revalidation)
□ Agregacja (SUM, COUNT) liczy po złym polu lub złej relacji
□ Soft delete — rekordy "usunięte" są nadal liczone

KATEGORIA D — Problem z cache / state:
□ Frontend pokazuje stare dane z TanStack Query / SWR cache
□ Cache nie jest invalidowany po mutacji
□ Revalidation jest ale na złym kluczu query
□ Server-side cache (Redis / CDN) serwuje stary wynik

KATEGORIA E — Problem z walidacją / wczesnym zwrotem:
□ Handler zwraca 200 przed wykonaniem aktualizacji (wcześniejszy return)
□ Walidacja odrzuca dane cicho (bez błędu do klienta) i przerywa operację
□ Guard / middleware blokuje operację ale zwraca sukces

KATEGORIA F — Problem z migracją / schematem:
□ Kolumna istnieje w kodzie ale nie w bazie (migracja nie uruchomiona)
□ Kolumna ma DEFAULT który nadpisuje zapis
□ Trigger bazodanowy który nadpisuje wartość po UPDATE
□ Constraint który cicho odrzuca zapis
```

**KROK 2.2 — Diagnoza końcowa**

```
=== DIAGNOSTICS REPORT ===

PRZYCZYNA GŁÓWNA (root cause):
[Jeden konkretny paragraf opisujący co jest zepsute i dlaczego]

LOKALIZACJA W KODZIE:
Plik: _____________
Linia / funkcja: _____________
Fragment kodu który jest błędny:
```
[wklej problematyczny fragment]
```

DLACZEGO TO POWODUJE OBJAW:
[Wyjaśnienie związku przyczynowego — jak ten błąd prowadzi do opisanego objawu]

ZAKRES WPŁYWU:
□ Czy inne operacje mają ten sam błąd?
□ Czy dane historyczne są już zdezaktualizowane?
□ Czy błąd może powodować niespójność danych w bazie?

ZATWIERDŹ DIAGNOZĘ PRZED KONTYNUACJĄ:
Czy powyższy opis zgadza się z Twoją obserwacją systemu?
Odpowiedz TAK / NIE / CZĘŚCIOWO + komentarz.
========================
```

> **STOP.** AGENT DIAGNOSTICS czeka na potwierdzenie diagnozy przed przekazaniem do SURGEON.
> Jeśli diagnoza jest błędna — napisz co jest nie tak, DIAGNOSTICS iteruje.

---

## ══════════════════════════════════════════════════
## AGENT 3 — SURGEON
## Cel: Wykonać minimalną, precyzyjną naprawę
## ══════════════════════════════════════════════════

### Instrukcja dla agenta:

Działasz wyłącznie na ZATWIERDZONEJ diagnozie. Zmieniasz MINIMUM konieczne do naprawy. Nie refaktoryzujesz. Nie ulepszasz. Nie zmieniasz niczego co nie jest bezpośrednio związane z diagnozą.

**KROK 3.1 — Plan naprawy (przed wprowadzeniem zmian)**

```
PLAN NAPRAWY:

Zmiana 1:
  Plik: _____________
  Co zmieniamy: _____________
  Dlaczego ta zmiana naprawia problem: _____________

Zmiana 2 (jeśli wymagana):
  Plik: _____________
  Co zmieniamy: _____________
  Dlaczego: _____________

Czego NIE zmieniamy i dlaczego:
  _____________

Czy wymagana migracja bazy danych: TAK / NIE
Jeśli TAK — opisz co zmienia: _____________

Czy wymagany restart serwisu: TAK / NIE
```

**KROK 3.2 — Implementacja**

Dla każdej zmiany pokaż:

```
PRZED (oryginalny kod):
// plik: [ścieżka], linia: [nr]
[oryginalny fragment]

PO (naprawiony kod):
// plik: [ścieżka], linia: [nr]
[naprawiony fragment]

UZASADNIENIE KAŻDEJ LINII ZMIANY:
- linia X: [dlaczego ta linia jest zmieniona]
- linia Y: [dlaczego ta linia jest dodana/usunięta]
```

**REGUŁY NIEZMIENNICZE DLA SURGEON:**

```
ZAKAZ:
□ Zmiany w plikach niezwiązanych z diagnozą
□ Refaktoryzacja przy okazji ("przy okazji poprawię też...")
□ Zmiana sygnatury funkcji / API bez konieczności
□ Dodawanie nowych zależności / bibliotek
□ Zmiana struktury bazy bez zatwierdzonej migracji

NAKAZ:
□ Każda zmiana ma uzasadnienie w diagnozie
□ Jeśli naprawienie wymaga transakcji — użyj transakcji zgodnej z istniejącym ORM/stackiem
□ Zachowaj konwencje nazewnicze które już istnieją w projekcie
□ Jeśli dodajesz aktualizację licznika — użyj tego samego wzorca co reszta kodu
```

**Wzorce naprawy zależnie od stacku (użyj właściwego):**

```typescript
// WZORZEC: Prisma — atomowa aktualizacja licznika w transakcji
await prisma.$transaction(async (tx) => {
  // 1. Zapisz encję podrzędną
  await tx.serviceLog.create({ data: { ...input, contractId } })

  // 2. Przelicz z bazy (nie z pamięci — żeby uniknąć race condition)
  const { _sum } = await tx.serviceLog.aggregate({
    where: { contractId },
    _sum: { hours: true },
  })

  // 3. Zaktualizuj encję nadrzędną atomowo
  await tx.contract.update({
    where: { id: contractId },
    data: {
      usedHours: _sum.hours ?? 0,
      status: (_sum.hours ?? 0) >= contract.totalHours ? 'DEPLETED' : 'ACTIVE',
    },
  })
})

// WZORZEC: TypeORM — transakcja z query builder
await dataSource.transaction(async (manager) => {
  await manager.save(ServiceLog, { ...input, contractId })
  await manager.query(
    `UPDATE contracts
     SET used_hours = (SELECT COALESCE(SUM(hours), 0) FROM service_logs WHERE contract_id = $1)
     WHERE id = $1`,
    [contractId]
  )
})

// WZORZEC: TanStack Query — invalidacja cache po mutacji
const mutation = useMutation({
  mutationFn: addServiceLog,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    queryClient.invalidateQueries({ queryKey: ['contracts'] }) // lista też
  },
})

// WZORZEC: NestJS — serwis z transakcją Prisma
@Injectable()
export class ServiceLogsService {
  constructor(private prisma: PrismaService) {}

  async create(contractId: string, dto: CreateServiceLogDto) {
    return this.prisma.$transaction(async (tx) => {
      const log = await tx.serviceLog.create({
        data: { ...dto, contractId },
      })
      await this.recalculateContract(tx, contractId)
      return log
    })
  }

  private async recalculateContract(tx: Prisma.TransactionClient, contractId: string) {
    const { _sum } = await tx.serviceLog.aggregate({
      where: { contractId },
      _sum: { hours: true },
    })
    const usedHours = _sum.hours ?? 0
    await tx.contract.update({
      where: { id: contractId },
      data: { usedHours, updatedAt: new Date() },
    })
  }
}
```

---

## ══════════════════════════════════════════════════
## AGENT 4 — VERIFIER
## Cel: Udowodnić że naprawa działa — z testami przed i po
## ══════════════════════════════════════════════════

### Instrukcja dla agenta:

Weryfikujesz naprawę przez konkretne testy. Każdy test ma stan PRZED i stan PO. Raportujesz PASS/FAIL z dowodem — nie z oceną.

**KROK 4.1 — Test podstawowy (reprodukcja błędu)**

```
TEST-001: Reprodukcja oryginalnego błędu
Cel: Udowodnić że błąd rzeczywiście istniał przed naprawą

Dane testowe:
  - contract.id = [test ID lub fixture]
  - contract.totalHours = 100
  - contract.usedHours = 0 (stan początkowy)

Akcja: Dodaj service log z hours = 8

Wynik PRZED naprawą:
  - contract.usedHours = [co faktycznie było] ← FAIL jeśli 0
  - contract.status = [co faktycznie było]

Wynik PO naprawie:
  - contract.usedHours = 8 ← PASS
  - contract.status = ACTIVE ← PASS
```

**KROK 4.2 — Testy invariantów**

Dla każdego invariantu zdefiniowanego lub wynikającego z modelu danych:

```
TEST-002: Invariant — suma godzin
Warunek: contract.usedHours ZAWSZE = SUM(service_logs.hours WHERE contract_id = contract.id)

Weryfikacja:
  SELECT SUM(hours) FROM service_logs WHERE contract_id = '[id]';
  -- musi być równe contract.used_hours w tabeli contracts
  Wynik: PASS / FAIL

TEST-003: Invariant — status
Warunek: Gdy usedHours >= totalHours → status = DEPLETED

Weryfikacja:
  Dodaj logi sumujące do totalHours, sprawdź status
  Wynik: PASS / FAIL

TEST-004: Invariant — spójność po wielu operacjach
Dodaj 5 logów sekwencyjnie. Po każdym sprawdź usedHours.
  Wynik: PASS / FAIL
```

**KROK 4.3 — Test cache / state frontendu**

```
TEST-005: UI pokazuje aktualne dane po operacji
Akcja: Dodaj service log przez UI
Oczekiwanie: Bez ręcznego odświeżenia strony — licznik się aktualizuje
Mechanizm: [TanStack Query invalidation / SWR revalidate / manual refetch]
Wynik: PASS / FAIL
```

**KROK 4.4 — Test edge cases**

```
TEST-006: Wyczerpanie kontraktu
Dodaj log który przekracza totalHours
Oczekiwanie: status = DEPLETED, UI blokuje kolejne zgłoszenia (jeśli tak zaprojektowano)
Wynik: PASS / FAIL

TEST-007: Równoczesne zapisy (jeśli dotyczy systemu wielodostępowego)
Dwa requesty jednocześnie do tego samego contractId
Oczekiwanie: usedHours = suma obu, brak podwójnego liczenia
Wynik: PASS / FAIL (jeśli nie dotyczy — pomiń)

TEST-008: Dane historyczne
Jeśli błąd istniał wcześniej — czy w bazie są zdezaktualizowane rekordy?
Weryfikacja: [zapytanie SQL sprawdzające spójność]
Wynik: PASS / FAIL / WYMAGA SKRYPTU NAPRAWCZEGO
```

**KROK 4.5 — Raport weryfikacji**

```
=== VERIFICATION REPORT ===

TEST-001: PASS / FAIL
TEST-002: PASS / FAIL
TEST-003: PASS / FAIL
TEST-004: PASS / FAIL
TEST-005: PASS / FAIL
TEST-006: PASS / FAIL
TEST-007: PASS / FAIL / N/A
TEST-008: PASS / FAIL / WYMAGA NAPRAWY DANYCH

WYNIK OGÓLNY: PASS / PARTIAL / FAIL

Jeśli FAIL lub PARTIAL:
- Wróć do AGENT DIAGNOSTICS z nową informacją
- NIE oddawaj systemu jako naprawionego jeśli są FAILe
========================
```

---

## ══════════════════════════════════════════════════
## AGENT 5 — REPORTER
## Cel: Udokumentować co zostało zmienione i dlaczego
## ══════════════════════════════════════════════════

### Instrukcja dla agenta:

Tworzysz dokument przekazania — czytelny dla kogoś kto nie uczestniczył w diagnozie.

```
=== REPAIR REPORT ===
Data: [data]
System: [nazwa/opis systemu]
Stack: [technologie]

PROBLEM:
[Jeden paragraf opisujący objaw z perspektywy użytkownika]

PRZYCZYNA:
[Jeden paragraf opisujący root cause technicznie]

NAPRAWIONE PLIKI:
1. [ścieżka/plik.ts] — [co zmieniono w jednym zdaniu]
2. [ścieżka/plik.ts] — [co zmieniono]

KLUCZOWA ZMIANA:
[Fragment kodu PRZED i PO — najważniejsza zmiana]

TESTY:
Wszystkie testy: PASS
lub
Testy z PASS: [lista]
Testy z FAIL: [lista + opis co jeszcze wymaga pracy]

UWAGI DLA PRZYSZŁOŚCI:
[Czy ten sam błąd może wystąpić w innych miejscach systemu?]
[Co można zrobić żeby zapobiec podobnym błędom?]

DANE HISTORYCZNE:
[Czy w bazie są zdezaktualizowane rekordy? Jeśli tak — czy wymagają skryptu naprawczego?]
========================
```

---

## ══════════════════════════════════════════════════
## INSTRUKCJA URUCHOMIENIA
## ══════════════════════════════════════════════════

```
Wypełniłem Sekcję 0 powyżej. Uruchom sekwencję agentów naprawczych:

FAZA 1 — AGENT DISCOVERY:
Przeczytaj dostępny kod i wygeneruj DISCOVERY REPORT.
Nie zakładaj niczego — zmapuj to co faktycznie istnieje.
Poczekaj na moje potwierdzenie raportu przed przejściem dalej.

FAZA 2 — AGENT DIAGNOSTICS:
Na podstawie DISCOVERY REPORT postaw hipotezy i zweryfikuj je kodem.
Wygeneruj DIAGNOSTICS REPORT z lokalizacją błędu.
Poczekaj na moje potwierdzenie diagnozy przed wprowadzeniem zmian.

FAZA 3 — AGENT SURGEON:
Dopiero po potwierdzeniu diagnozy — wprowadź minimalne zmiany naprawcze.
Pokaż PRZED i PO dla każdej zmiany.

FAZA 4 — AGENT VERIFIER:
Przeprowadź wszystkie testy. Raportuj PASS/FAIL z dowodem.
Jeśli jakikolwiek test FAIL — wróć do DIAGNOSTICS.

FAZA 5 — AGENT REPORTER:
Wygeneruj REPAIR REPORT.

ZASADA NADRZĘDNA:
Jeśli architektura systemu różni się od wzorców w tym prompcie —
adaptuj wzorce do rzeczywistego stacku. Nigdy nie odrzucaj zadania
z powodu różnicy w architekturze.
```

---

*MASTER PROMPT NAPRAWCZY v1.0*
