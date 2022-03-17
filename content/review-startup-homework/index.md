---
title: "Review after the homework of a Startup - 어떤 스타트업의 과제 전형 참여 후기"
date: 2020-11-10 10:54:00 +0900
tags:
  - Spring Boot 
  - Spring Data JPA
  - OOP
  - Java
emoji: 💻
author: 개발한입
categories: 개발
---

```toc
```

- STEP 1. 구현 중에 맞딱드린 고민과 해결방법
    - STEP 1.1 콜렉션 리팩토링에 대한 고민
    - STEP 1.2 인조키와 자연키에 대한 고민
    - STEP 1.3 JPA 설계에 대한 고민
- STEP 2. 트러블 슈팅
    - STEP 2.1 JPA LazyInitializationException 핸들링
    - STEP 2.2 동일 객체 GroupBy 핸들링
- STEP 3. 아쉬운 점
    - STEP 3.1 정적 팩토리 메소드 리팩토링 관련
- STEP 4. 참고자료(REFERENCE)

# 개요

모 스타트업의 과제 전형을 참가 한 뒤에 스스로 코드 리뷰 및 후기를 남기기 위해서 작성해보겠다.

과제는 스프링을 활용한 작은 규모의 커맨드 라인 서비스를 만드는 것이었고, 더미테이블이 주어졌다.

자세한 내용은 비밀로 유지해달라는 부탁을 받아서,  아쉽게도 전체 코드를 공개를 못하게 됐지만 내가 과제를 하면서 고민했던 부분들을 따로 정리하고자 이 포스트를 작성한다.

# STEP 1. 구현 중에 맞딱드린 고민과 해결방법

## STEP 1.1 콜렉션 리팩토링에 대한 고민

과제를 진행하면서 무분별하게 콜렉션이 남발되는 부분이 있었다.

이를 처리하기 위해서 일급 콜렉션을 도입하자고 생각하였다.

이전부터 일급 콜렉션을 활용하는 방법과 장점을 알고 있었으나, 개념만 익혀놨을 뿐 써보지는 않았었다. 그래서 간단하게 정의와 장점을 알고 넘어가고자 한다. 

일단, 먼저 일급 콜렉션이 무엇인지? 알아보고자 한다. 

아래와 같이 카드덱 클래스가 존재한다고 가정하자.

카드덱 클래스는 Card객체의 List를 가지고 있다. 

```java
public class CardDeck {

    private static final int CARD_DECK_SIZE = 13;
    private static final int PATTERN_A_NUMBER = 1;
    private static final int PATTERN_J_NUMBER = 11;
    private static final int PATTERN_Q_NUMBER = 12;
    private static final int PATTERN_K_NUMBER = 13;

    private List<Card> cards = new ArrayList<>();
    ...
```

이런 List<Card> 를 Wrapping을 아래의 코드와 같이 한다.

```java
public class Cards {

    private List<Card> cards;

    public Cards(List<Card> cards) {
        this.cards = cards;
    }
}
```

즉, 어떤 Collection을 **Class로 Wrapping하는데 Wrapping한 대상이 된 Collection 의외에 다른 멤버변수가 없게 하는 것**이 일급 콜렉션이다.

이렇게 함으로써 어떤 장점을 가지게 될까?

1. 비즈니스에 종속적인 자료구조 생성
2. Collection의 불변성(Immutable)을 보장
3. 상태와 행위를 한 곳에서 관리
4. 이름이 있는 콜렉션

하나씩 살펴보고자 한다.

### STEP 1.1.1 비즈니스에 종속적인 자료구조 생성

```java
...

private static final String[] patterns = {
            CardSuit.SPADE.name(),
            CardSuit.HEART.name(),
            CardSuit.DIAMOND.name(),
            CardSuit.CLUB.name()
    };

...

private void generatedCardDeckByPattern(String pattern){
        for(int i = 1; i <= CARD_DECK_SIZE; i++){
            String denomination = numberToDenomination(i);
            Card card = new Card(CardSuit.valueOf(pattern), denomination);
            this.cards.add(card);
        }
    }

private void generatedAllCardDeck() {
        for(int i = 0; i < CardDeck.patterns.length; i++) {
            generatedCardDeckByPattern(CardDeck.patterns[i]);
        }
    }
```

CardDeck은 위와 같은 행위를 통하여 전체 카드 52장을 만들어 낸다. 

이때, 나는 enum(cardSuit)을 통하여 패턴(스페이드, 하트, 다이아, 클로버) 등을 처리했다.

그렇다면 이에 대한 검증 로직은 어디서 처리해야될까?

물론, CardDeck에서 처리해도 된다고 생각이 들지만, 만약 비즈니스 로직이 많아지면서 클래스에 방대한 로직들이 쌓이게 된다면 검증로직을 쉽사리 찾기도 힘들 것이다.

또한, 코드나 도메인을 모르는 사람들이 볼 때도 문제가 발생할 소지가 있다.

그래서 이것을 일급 콜렉션으로 뺀다면 다음과 같이 해결 할 수 있을 것이다.

```java
public class Cards {
    private static final int CARDS_SIZE = 52;

    private final List<Card> cards;

    public Cards(List<Card> cards) {
        validationSize(cards);
        validateDuplicate(cards);
        this.cards = cards;
    }

    private void validationSize(List<Card> cards) {
        if(cards.size() != CARDS_SIZE) {
            throw new IllegalArgumentException("전체 생성된 카드의 크기는 52장여야 합니다.");
        }
    }

    private void validateDuplicate(List<Card> cards) {
        Set<Card> nonDuplicatedCards = new HashSet<>(cards);
        if(nonDuplicatedCards.size() != cards.size()){
            throw new IllegalArgumentException("카드는 중복 생성할 수 없습니다.");
        }
    }
}
```

이렇게 함으로서 비즈니스 로직에 종속적인 자료구조를 생성하며, 상태와 행위를 한 곳에 집중시킬 수 있으며, 이름을 갖는 콜렉션을 사용할 수 있다.

### STEP 1.1.2 Collection의 불변성을 보장

여기서 가장 중요한 것은 콜렉션 특성상 **Getter를 그대로 사용하면 레퍼런스 관계가 되어 값을 추가** 할 수 있다. 따라서, 일급 콜렉션의 불변성을 보장하기 위해서는 **필요한 값만을 반환**하는 별도의 메소드들을 만들어서 사용해야 한다.

나 또한, 별 생각없이 지나갔던 부분이었는데 이 부분은 [일급 컬렉션을 사용하는 이유](https://woowacourse.github.io/javable/2020-05-08/First-Class-Collection)를 보면서 알게되었다. 

해당 포스트의 샘플 코드를 몇개 가져와서 예시를 들어 설명해보겠다.

로또 프로젝트를 진행한다고 가정했을 때 로또(Lotto)는 난수 6개인 로또번호(LottoNumber)를 리스트로 들고 있을 것이다. 

```java
public class Lotto {
    private final List<LottoNumber> lotto;

    public Lotto(List<LottoNumber> lotto) {
        this.lotto = new ArrayList<>(lotto);
    }

    public List<LottoNumber> getLotto() {
        return lotto;
    }
}

public class LottoNumber {
    private final int lottoNumber;

    public LottoNumber(int lottoNumber) {
        this.lottoNumber = lottoNumber;
    }
}
```

이때 위의 getLotto()와 같이 Getter를 사용하면 콜렉션과 레퍼런스 관계가 되기때문에 값을 추가할 수 있다.

```java
@Test
public void lotto_변화_테스트() {
    List<LottoNumber> lottoNumbers = new ArrayList<>();
    lottoNumbers.add(new LottoNumber(1));
    Lotto lotto = new Lotto(lottoNumbers);
    lottoNumbers.add(new LottoNumber(2));
}
```

따라서 일급 콜렉션의 불변을 보장하고 싶으면 위와 같이 **내부 변수를 그대로 반환하는 Getter의 사용**을 지양해야한다. 즉, 콜렉션 값을 그대로 반환하는 것을 없애는 것이 좋다.

만약 그것들이 필요하다 하면 [일급 컬렉션을 사용하는 이유](https://woowacourse.github.io/javable/2020-05-08/First-Class-Collection) 하단에 어떻게하면 불변을 보장하면서 Getter를 사용할 수 있는지 나온다.

### STEP 1.1.3 과제에서 활용한 방법

다시 과제 이야기로 돌아와 내가 일급 콜렉션을 쓰게 된 계기는 Order 클래스는 주문과 관계된 클래스다보니 비즈니스 로직이 많이 쌓일 수 밖에 없는 구조를 갖게되었다. 

그러다보니 자주 쓰는 콜렉션 중에서 주문과 관련된 콜렉션을 일급 콜렉션화하자라는 생각을 하게됐고, 아래와 같이 구현했다. 

```java
@Getter
//기본 생성자 제한
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class OrderProductGroups {

    private final List<OrderProduct> orderProducts;

    public OrderProductGroups(List<OrderProduct> orderProducts) {
        this.orderProducts = orderProducts;
    }

    public Set<Product> toMovieSet(){
        return orderProducts.stream()
                .map(OrderProduct::getProduct)
                .filter(product -> product.getProductType().equalsIgnoreCase("movie"))
                .collect(Collectors.toSet());
    }

    public List<Product> toMovieList(){
        return orderProducts.stream()
                .map(OrderProduct::getProduct)
                .filter(product -> product.getProductType().equalsIgnoreCase("movie"))
                .collect(Collectors.toList());
    }

	  ...
}
```

기존에 List<OrderProduct>를 사용했는데 Order 비즈니스 로직이 해당 리스트로 인하여 너무 지저분해지고 있었다. 따라서, List<OrderProduct>를 OrderProductGroups라는 일급콜렉션화를 진행하였다.

이를 통해서 코드가 매우 간결해지고 깔끔해짐을 알 수 있었는데 어떤 결과가 생겼는지 알아보자. 

살펴볼 코드의 로직은 아주 단순하다. List를 Set으로 만들어 사이즈가 다를 경우 중복값이 존재하니 해당 경우에 예외를 던지는 코드였다.

- 리팩토링 전

```java
private static void checkDuplicatedMovie(List<OrderProduct> orderProducts) {
    if (isDuplicatedMovie(orderProducts)) {
        throw new DuplicatedMovieOrderException("같은 Movie를 여러 개 주문이 불가합니다.");
    }
}

private static boolean isDuplicatedMovie(List<OrderProduct> orderProducts){

    List<Product> movies = orderProducts.stream()
                .map(OrderProduct::getProduct)
                .filter(product -> product.getProductType().equalsIgnoreCase("movie"))
                .collect(Collectors.toList());

    Set<Product> movieSet = orderProducts.stream()
                .map(OrderProduct::getProduct)
                .filter(product -> product.getProductType().equalsIgnoreCase("movie"))
                .collect(Collectors.toSet());

    return movies.size() != movieSet.size();
}
```

- 일급 콜렉션 사용을 통한 리팩토링 후

```java
private static void checkDuplicatedMovie(OrderProductGroups orderProductGroups) {
  if (isDuplicatedMovie(orderProductGroups)) {
      throw new DuplicatedMovieOrderException("같은 Movie를 여러 개 주문이 불가합니다.");
  }
}

private static boolean isDuplicatedMovie(OrderProductGroups orderProductGroups){
    List<Product> products = orderProductGroups.toMovieList();
    Set<Product> productSet = orderProductGroups.toMovieSet();
    return products.size() != productSet.size();
}
```

이렇게 매우 깔끔해짐을 알 수가 있다. 또한, List<OrderProduct>에 영향을 받던 다른 코드들도 마찬가지로 깔끔하게 리팩토링을 할 수 있게 되었다.

## STEP 1.2 인조키와 자연키에 대한 고민

과제는 위에서 말한거처럼 더미테이블이 주어졌다. 이때 나는 Spring Data JPA를 도입하였는데 고민했던 부분은 PK 설정에 대한 부분이었다.

혼자 프로젝트를 진행하거나 스터디를 진행했을 때는 PK를 단순하게 JPA 전략이 알아서하게끔 처리했었는데 이게 맞는 것인지에 대해서는 깊게 생각을 안했었다. 

하지만, 주어진 더미데이터에는 PK로 쓸 수 있는 부분이 있었고 이에 대해서 고민하기 시작했다. 이때, 인조키와 자연키에 대해서 알게 되었다.

- 자연키(Natural Key)란?

**비즈니스 모델에서 자연스레 나오는 속성을 기본키로 정하는 것**

- 인조키(Artificial Key)란?

**속성 중에서 기본키로 추출할 속성이 없어서 인위적으로 고유번호를 지정하는 것**

자연키는 예시로 들 수 있는 것이 주민등록번호가 있을 것이다. 

인조키는 예시로 들 수 있는 것이 UUID나 DB 자체에서 생성된 시퀀스로 볼 수 있을 것이다.

나는 자연키는 따로 필드를 빼두고 인조키를 PK로 활용하는 방안으로 설계를 진행하였다. 이 말은 그냥 JPA에서 알아서 PK를 처리하도록 하게끔 `@GeneratedValue(strategy = GenerationType.IDENTITY)` 전략을 활용하였다는 말이다.

이 부분에 대해서 좀 더 알고 싶으면 해당 포스팅을 추천한다.

[기본키는 무엇으로 할까 - 자연키, 인조키](https://multifrontgarden.tistory.com/180)

## STEP 1.3 JPA 설계에 대한 고민

주어진 과제에서 상품(Item)을 처리하는 부분이 있었는데 상품은 2개의 카테고리로 분리되어있었다. 그러나, 이것을 제외하고는 모든 필드가 동일하였다. 

만약, 두 카테고리가 다른 부분이 존재하였으면 공통부분은 추상클래스로 뺀 후에 처리를 했을 것 같다. 하지만 모든 필드가 동일한 것에 대해서는 어떻게 처리해야될까 고민했다.

- 카테고리 클래스를 따로 빼서 처리해야될까?
- 각각 카테고리로 나눠진 상품의 개별 클래스를 나눠서 짤까?

결론 끝에 도달한 것은 상품이라는 클래스는 언제나 변화무쌍할 수 있다는 것이다. 과제에서 주어진 요구사항은 단순했지만, 각각 카테고리에 나중에 부분적으로 변화할 수 있는 부분들이 있다고 생각하였다. 

또한, 상태는 같아도 행위자체는 다르게 동작해야하는 부분들이 존재했다.

따라서, 확장 가능성과 유지보수의 용이성으로 볼 때 추상클래스를 도입하는게 좋다고 판단하였다.

- 추상클래스 Product

```java
@Entity
@Table(name = "tbl_prod")
@DiscriminatorColumn
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
public abstract class Product {
		
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "prod_id")
    protected Long id; //인조키

    @Column(name = "prod_key")
    protected Long naturalKey; // 자연키 = 상품번호

    // @DiscriminatorColumn 기본값이 dtype이다. 
    // 카테고리에 따라서 다르게 동작해야할 로직이 존재해서 카테고리 참조를 위해 추가
    @Column(name="dtype", nullable=false, updatable=false, insertable=false)
    protected String productType;

		...
}
```

- 자식클래스 Book

```java
@Getter
@Entity
@Table(name = "tbl_book")
@DiscriminatorValue("book")
@PrimaryKeyJoinColumn(name = "book_id")
// JPA 기본 생성자 생성 제한
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Book extends Product {
    // 상태 존재 X
    // 추상클래스 상태의 접근제어자들이 protected로 선언 되어있음
    // 자식 클래스에서 concrete object로 생성하게끔 함.
    @Builder
    public Book(Long id, Long naturalKey, String productType, ... ) {
        this.id = id;
        this.naturalKey = naturalKey;
        this.productType = productType;
				...
    }
	...
}
```

과제의 기한이 7일이 주어진 타임어택형 과제였기 때문에, JPA의 Inheritance strategy로 `SINGLE_TABLE` 전략을 활용하기로 했다. 물론, `JOINED` 전략이 훨씬 정규화되어있고 좋기야하겠지만 가뜩이나 처리가 빡센 JPA 조인을 트러블 슈팅을 하면서 시간을 쓸 바에는 간단한 `SINGLE_TABLE` 전략이 낫다고 생각하여 채택했다. 

JPA의 상속 전략에 대해서 알고 싶으면 [[JPA] 상속관계 매핑 전략(@Inheritance, @DiscriminatorColumn)](https://ict-nroo.tistory.com/128) 이 포스팅을 읽어보도록 하자.

# STEP 2. 트러블 슈팅

## STEP 2.1 JPA LazyInitializationException 핸들링

![ERD](https://user-images.githubusercontent.com/22961251/98634956-05e6cb80-231c-11eb-98ae-7c59859fe0d0.png)

위의 구조는 내가 사용한 JPA 객체 관계를 표시한 다이어그램이라 볼 수 있다. 

Product ↔ Order는 다대다의 관계를 갖는데, JPA에서 `@ManyToMany` 키워드로 테이블을 생성하면 아래와 같이 조인을 위한 OrderProduct 테이블이 생성된다.

그러나, 기본 생성되는 연결 테이블(OrderProduct)은 필드를 추가하거나 제거하거나 혹은 비즈니스 로직을 담을 수 없다.

왜냐하면, 기본 생성되는 조인 테이블은 매핑 정보만 넣는 것이 가능하고, 추가 정보를 넣는 것 자체가 불가능하기 때문이다. 또한, Order와 Product는 엔티티를 우리가 생성한거여서 내부적으로 비즈니스 로직이나 검증처리를 할 수 있지만, OrderProduct 테이블은 자체 생성되는 것이기 때문에 그러한 로직처리가 불가능하다. 

따라서, ManyToMany 관계는 조인 테이블 엔티티를 따로 만든 후에 일대다, 다대일 관계로  풀어주는 것이 맞다.

즉, 기본 생성되는 연결 테이블을 엔티티로 승격해주는 것이다.

```java
@Getter
@Entity
@Table(name = "tbl_order_prod")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrderProduct {

    @Id
    @Column(name = "order_prod_id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
		
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prod_id")
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

   ...
}
```

이런 식으로 연결 테이블을 엔티티로 승격시킬 수가 있다.

그렇다면 지금까지 이야기한 내용과 `LazyInitializationException`과 무슨 상관관계가 있을까?

주목해야될 것은 `@ManyToOne(fetch = FetchType.LAZY)` 부분이다.

### STEP 2.1.1 JPA 지연로딩과 즉시로딩

JPA에서는 엔티티를 조회할 때 두 가지 방식을 사용할 수 있다. 

바로, **즉시로딩(Eager Loading)**과 **지연로딩(Lazy Loading)**이다. 

두 개는 무슨 차이일까?

아래와 같은 코드가 가정하고 살펴보자.

- Member 엔티티

```java
@Getter
@Entity
public class Member {
	private String username;
	
	@ManyToOne
	private Team team;
	
	...
}
```

- Team 엔티티

```java
@Getter
@Entity
public class Team {
	private String name; 
}
```

위와 같이 Member 엔티티와 Team  엔티티가 있고, 팀과 회원을 모두 출력하는 로직과 회원만 출력하는 로직이 있다고 하자.

- 회원과 팀 정보를 출력하는 비즈니스 로직

```java
public void printUserAndTeam(String memberId) {
	Member member = em.find(Member.class, memberId);
	Team team = member.getTeam();
	System.out.println("회원 이름 : " + member.getUsername());
	System.out.println("소속팀 : " + team.getName();
}
```

- 회원만 출력하는 비즈니스 로직

```java
public void printUser(String memberId) {
	Member member = em.find(Member.class, memberId);
	System.out.println("회원 이름 : " + member.getUsername());
}
```

코드를 보면 알겠지만, Team과 Member 엔티티가 연관관계에 있어도 회원만 출력하는 경우 Team까지 함께 조회하는 것을 효율적이지 않다.

JPA는 이러한 문제를 해결하려고 **엔티티가 실제 사용될 때까지 데이터베이스 조회를 지연하는 것을 제공**하는데 그것이 지연로딩(Lazy Loading)이다.

쉽게 이야기해서 Team과 Member가 연관관계에 있어도 team.getTeam()과 같이 직접적으로 사용하지 않을 때는 DB에 접근해서 가져오지 않는 것을 말한다.

이러한 지연로딩을 처리하기 위해서 실제 엔티티 객체 대신에 데이터베이스 조회를 지연할 객체가 필요한데 이것을 프록시객체라 한다.

지연로딩과 즉시로딩을 정리를 하면 다음과 같다.

- **즉시 로딩(Eager Loading)** : **엔티티를 조회할 때 연관된 엔티티도 함께 조회된다.**
    - 예) em.find(Member.class, memberId)를 하게되면 Team 엔티티도 조회된다.
    - 사용 방법 : @ManyToOne(fetch = fetchType.EAGER)
- **지연 로딩(Lazy Loading)** : **연관된 엔티티를 실제 사용할 때 조회한다.**
    - 예) member.getTeam().getName() 처럼 조회한 팀을 실제 사용할 때 SQL를 호출한다.
    - 사용 방법 : @ManyToOne(fetch = fetchType.LAZY)

그런데, 나는 모든 페치 전략을 LAZY로 둔 상태였다.

일부로 즉시 로딩의 사용을 배제한 채 모두 지연 로딩으로 설정했는데 그 이유는 다음과 같다.

1. **예상치 못한 SQL이 발생한다.**

    → 연관관계를 5개를 들고 있는 엔티티면 조인이 5번 일어난다.

2. **JPQL에서 즉시로딩은 N+1 문제를 일으킨다.**

    → LAZY 페치전략도 N+1문제를 일으키긴하지만 EAGER의 경우 심각하다

해당 케이스를 좀 더 깊게 보기 위해서 N+1 문제에 대해서 알아보고자 한다.

### STEP 2.1.2 JPA N+1 문제

해당 예시를 살펴보기 위해서 [JPA N+1 발생원인과 해결 방법](https://www.popit.kr/jpa-n1-%EB%B0%9C%EC%83%9D%EC%9B%90%EC%9D%B8%EA%B3%BC-%ED%95%B4%EA%B2%B0-%EB%B0%A9%EB%B2%95/) 포스팅의 예제 코드를 가져왔다.

- 즉시로딩 N+1 문제

```kotlin
@Entity
@Table(name = "member")
class Member private constructor() {
    ...
    @OneToMany(mappedBy = "member", fetch = FetchType.EAGER)
    var orders: Set<Order> = emptySet()
        private set
}

@Entity
@Table(name = "orders")
class Order private constructor() {
    ...
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "member_id", nullable = false, updatable = false)
    lateinit var member: Member
        private set
```

코틀린이지만, 우리가 중요하게 보면 되는 부분은 연관 관계 부분이다. 해당 코드는 Member ↔ Order의 연관관계를 갖는데, 이 경우에 Member를 조회해도 Order를 가져오기 때문에 N+1 문제가 발생한다.

예를 들면, Member가 1명이고, Order가 10개인 경우에도 Select 쿼리가 10번 나가는 것을 확인할 수 있다.

즉, N+1 문제는 **N + 1 → 1 (회원) + N (주문)** 과 같이 1번 조회에 대해서 해당 조회에 연관관계가 얽힌 엔티티의 개수(N) 만큼 추가적으로 조회하는 문제이다. 만약, 주문 이외에 배송정보나 쿠폰정보 등이 포함되게 된다면, N + 1 쿼리는 

**1(회원) + N(주문) + N(배송정보) + N(쿠폰정보)**와 같이 매우 많은 쿼리가 발생하게 된다. 

이는 최악의 경우(Worst Case) 인데, 그 이유는 찾으려고 하는 값이 영속성 컨텍스트 내 존재하게 되면 조회 쿼리가 나가지는 않기 때문이다.

그렇다면 **지연로딩(Lazy Loading)을 통해서 N+1 문제를 해결 할 수 있을까?**

가능하다. 해당 코드의 fetch = FetchType.EAGER를 LAZY로 바꾸면 Member를 조회할 때 1번만 조회가 된다.

→ **Order를 실제 사용하기 전까지 Select해서 Order를 가져오지 않기 때문이다.**

그러나, **다른 케이스에서는 지연로딩을 사용하더라도 N+1 문제가 발생할 수 있다.**

```kotlin
@Test
internal fun `지연로딩인 n+1`() {
    val members = memberRepository.findAll()
    // 회원 한명에 대한 조회는 문제가 없다
    val firstMember = members[0]
    println("order size : ${firstMember.orders.size}")
    // 조회한 모든 회원에 대해서 조회하는 경우 문제 발생
    for(member in members){
        println("order size: ${member.orders.size}")
    }
}
```

위와 같이 `findAll()`로 구한 members의 각각 해당하는 Order를 구하려고 하면, N+1 문제가 지연로딩에서도 동일하게 발생함을 알 수가 있다.

이 케이스에서는 왜 N+1 문제가 발생하는 것일까?

원인은 JPQL때문이다. **JPQL은 글로벌 페치 전략을 완전히 무시하고 SQL을 실행한다.** 

`memberRepository.findAll()`은 `select * from member`와 같은 SQL을 생성한다.

아래와 같은 코드가 즉시 로딩과 지연 로딩에서 어떤 차이를 갖는지 알아보자.

```kotlin
val members = memberRepository.findAll()
```

- 즉시로딩인 경우
1. `select * from member`가 members에 바인딩
2. members의 글로벌 페치 전략이 EAGER이기 때문에 바인딩 된 후에 추가로 Order 객체 Select

- 지연로딩인 경우
1. `select * from member`가 members에 바인딩
2. members의 글로벌 페치 전략이 LAZY이기 때문에 바인딩 된 후 실제 Order 접근 시까지 조회쿼리 발생 X
3. 각 member의 order를 처리 → order 실제 사용 `member.order.size`
4. order를 조회해야함 → 즉, member 1건당 order 조회 N번 수행 N+1 문제 발생

즉, 지연로딩인 경우에는 **`@OneToMany` 관계를 갖고 있는 Collection 내용에 접근할 때 N+1 문제가 발생한다.**

변수에 접근할 때마다 쿼리가 날아가는 것이다.

이 N+1 문제를 해결하기 위해서 자주 쓰는 방법 중에 하나가 **페치 조인(Fetch Join)**이 있다. 

하지만, 나 같은 경우에는 N+1 문제가 발생한 부분도 있었지만 다른 문제도 갖고 있었는데 바로 `LazyInitializationException` 문제였다. 이것 또한 fetch join으로 해결 하였는데 어떻게 해결했는지 알아보자

### STEP 2.1.3 Fetch Join을 통한 트러블 슈팅

내가 수행한 과제의 경우에서 Product ↔ OrderProduct ↔ Order의 연관관계를 갖고 있었다.

N+1 문제는 사실 Fetch Join을 많이 사용하는 용례를 설명하기 위해서도 있고 정리를 위해서 겸사겸사 정리하였다.

나에게 더 중요한 문제는 `LazyInitializationException` 핸들링이었다.

- OrderResponseInfo (Order DTO 클래스)

```java
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class OrderResponseInfo {

    private Long id;
    ...
    private List<OrderProduct> orderProducts;

    public OrderResponseInfo(Long id, Order order) {
        this.id = id;
        ...
        this.orderProducts = order.getOrderProducts();
    }
}
```

- Order와 OrderProduct가 연관관계를 맺는 부분

```java
...
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
private final List<OrderProduct> orderProducts = new ArrayList<>();
...
```

Order는 OrderProduct와 @OneToMany 관계를 가지고 있다. OrderProduct는 아까전에 JPA 설계에 대한 고민 부분을 보면 Order와 Product가 @OneToMany 관계로 연결된 테이블을 엔티티로 승격시켰다고 말했었다.

여기서 내가 `LazyInitializationException` 예외를 맞딱드린 부분은 컨트롤러 부분에서 상품명을 출력할 때였다.

```java
private void printProductTitle(OrderResponseInfo dto) {
    ...
    for(OrderProduct orderProduct : dto.getOrderProducts()){
        // LazyInitializationException 발생!
       writer.append(orderProduct.getProduct().getTitle())
               .append(" - ").append(orderProduct.getCount())
               .append("개").append("\n");
    }
    ...
}
```

왜 발생한 것일까?  하이버네이트 API를 보면 해당 예외는 다음과 같을 때 발생한다고 한다.

> Indicates access to unfetched data outside of a session context. For example, when an uninitialized proxy or collection is accessed after the session was closed.

즉, 세션 컨텍스트 외부에 페치되지 않은 객체에 접근하고자 할 때 발생하는 예외인데 이를 쉽게 설명하자면 나는 지연로딩을 사용하고 있기 때문에 상위 엔티티를 조회했다고 한들 하위 엔티티가 직접적으로 가져와지지 않은 상태기 때문에 에러가 발생하는 것이다.

1. 조회 서비스가 Select를 위한 서비스 (트랜잭션이 걸린)에 조회 요청을 한다.
2. 조회 결과가 반환 되면서 트랜잭션 종료
    - 이때 Entity는 영속상태가 아니라, 준영속 상태로 빠진다.
    - 만약 EAGER 패치로 가져왔다면 Entity의 하위 Entity가 함께 가져왔을 것이다.

    → **그러나, Lazy로 가져온 경우라면 하위 엔티티는 존재하지 않는 상태.**
3. Lazy 로 가져온 데이터가 준 영속 상태에서 하위 엔티티를 조회하면 `LazyInitializationException`이 발생한다.

즉, 내 케이스의 경우에는 **OrderProduct를 가져왔어도 하위 엔티티인 Product는 가져오지 않은 상태**이다. 따라서 하위 엔티티에 대해서 조회하고자 하면 해당 예외가 발생하는 것이다.

이를 아주 간단하게 아래와 같이 해결할 수 있다.

- Fetch Join 사용을 통한 LazyInitializationException 트러블 슈팅

```java
public interface OrderRepository extends JpaRepository <Order, Long> {
    @Query("select distinct o from Order o " +
            "join fetch o.orderProducts op " +
            "join fetch op.product p " +
            "where o.id=?1")
    Optional<Order> findById(Long id);
}
```

Fetch Join을 사용하게 되면 **연관관계가 얽힌 객체를 조회할 때 프록시 객체를 사용하는 것이 아니라 실제 엔티티를 조회**한다. 따라서, 이를 통하여 연관 객체를 한번에 가져올 수 있는 것이다. LazyInitializationException뿐만 아니라 N+1 문제도 실제 엔티티를 조회하면서 연관 객체를 한번에 가져오면서 해결 할 수 있다.

단, Fetch Join도 한계점이 존재한다. 

해당 내용은 [JPA N+1 발생원인과 해결 방법](https://www.popit.kr/jpa-n1-%EB%B0%9C%EC%83%9D%EC%9B%90%EC%9D%B8%EA%B3%BC-%ED%95%B4%EA%B2%B0-%EB%B0%A9%EB%B2%95/)과 김영한님의 인프런 강의 [스프링부트-JPA-API개발-성능최적화](https://www.inflearn.com/course/%EC%8A%A4%ED%94%84%EB%A7%81%EB%B6%80%ED%8A%B8-JPA-API%EA%B0%9C%EB%B0%9C-%EC%84%B1%EB%8A%A5%EC%B5%9C%EC%A0%81%ED%99%94) 섹션 3부분에 아주 잘나와있으니 참고해보자.

## STEP 2.2 동일 객체 GroupBy 핸들링

동일한 상품이 단 건으로 여러번 주문 됐을 때,  하나의 그룹으로 묶는 것을 수행하고 싶었다.

이를 테면, 메로나 1개 / 메로나 3개 → 메로나 4개 이런식으로 말이다. 

이는 과제의 요구사항에는 없는 부분이였지만 모든 기능을 구현 후에 시간이 남아서 따로 처리했었다.

스트림을 그렇게 잘 다루는 편이 아니라 생각보다 오래걸렸었다.

- GroupBy를 위한 Mapping용 객체

```java
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class MappingOrderProduct {

    private Long id;
    ...

    public MappingOrderProduct(OrderProduct orderProduct) {
        this.id = orderProduct.getId();
        ...
    }

    public static List<OrderProduct> groupingByOrderProducts(OrderProductGroups orderProductGroups) {

        Map<Long, Integer> groupingMap = getGroupingMap(orderProductGroups);
        List<OrderProduct> orderProducts = orderProductGroups.removeDuplicate();

        updateGroupingOrderCount(groupingMap, orderProducts);
        return orderProducts;
    }

    private static void updateGroupingOrderCount(Map<Long, Integer> groupingMap, List<OrderProduct> orderProducts) {
        for(OrderProduct orderProduct : orderProducts){
            Integer groupingCount = groupingMap.get(orderProduct.getProduct().getNaturalKey());
            orderProduct.updateCount(groupingCount);
        }
    }

    private static Map<Long, Integer> getGroupingMap(OrderProductGroups orderProductGroups) {
        List<MappingOrderProduct> productGroups = orderProductGroups.toProductGroups();
        return createGroupingMapByProductGroups(productGroups);
    }

    private static Map<Long, Integer> createGroupingMapByProductGroups(List<MappingOrderProduct> productGroups) {
        return productGroups.stream()
                    .collect(groupingBy(MappingOrderProduct::getNaturalKey,
                            summingInt(MappingOrderProduct::getOrderCount)));
    }
```

1. 자연키를 통하여 기존 주문상품 리스트를 groupingBy를 한 후 주문 갯수를 summingInt를 통하여 합산한 Map 생성
2. 기존 주문상품 리스트를 자연키를 통하여 중복 제거 수행
3. Map을 통하여 합산된 주문 개수를 기존 주문상품 리스트에 업데이트하여 리턴 

이러한 방식으로 처리하였다. 

중복 제거는 일급 콜렉션으로 만든 OrderProductGroups에 구현해놨는데 아래와 같이 짰다.

```java
...
public List<OrderProduct> removeDuplicate(){
  return orderProducts.stream()
          .filter(distinctBy(orderProduct -> orderProduct.getProduct().getNaturalKey()))
          .collect(Collectors.toList());
}

public static <T> Predicate<T> distinctBy(Function<? super T, ?> f) {
    Set<Object> objects = new HashSet<>();
    return t -> objects.add(f.apply(t));
}
...
```

# STEP 3. 아쉬운 점

과제를 진행할 당시에는 몰랐지만, 혼자서 코드 리뷰를 한 뒤에 느낀 아쉬운 점을 적어보겠다.

## STEP 3.1 정적 팩토리 메소드 리팩토링 관련

위에서 설명한 것과 같이 Product를 추상 클래스로 선언 후에 사용했었다 얘기를 했었다.

그래서 concrete object인 Product를 extends한 하위 클래스를 생성할 때 빌더 패턴과 정적 팩토리 메소드 패턴을 활용했었다. 

- 하위 클래스의 Builder 부분

```java
@Builder
public Movie(Long id, Long naturalKey, ...) {
	this.id = id;
	this.naturalKey = naturlKey;
	...		
}

public static Movie createMovie(Long naturalKey, ...) {
	validation(naturalKey, ...);
	return Movie.builder()
	        .naturalKey(naturalKey)
            ...
	        .build();
}
```

- 구현한 정적 팩토리 메소드 패턴

```java
public class ProductFactory {
    public static Product createProduct(ProductRequestInfo dto){
        if("Movie".equalsIgnoreCase(dto.getProductType())){
            return Movie.createMovie(dto.getNaturalKey(), ... );
        } 
				...
        throw new IllegalArgumentException("Product 객체를 생성할 수 없습니다.");
    }

    public static Product getProduct(ProductResponseInfo dto){
        if("Movie".equalsIgnoreCase(dto.getProductType())){
            return Movie.getMovie(dto.getId(), ... );
        } 
				...
        throw new IllegalArgumentException("Product 객체를 생성할 수 없습니다.");
    }
}
```

사실 어떻게 보면 팩토리 패턴에 가까이 설계 했는데, 카테고리마다 다른 concrete object를 생성하기 때문에 분기 처리를 하여 처리했다. 

여기서 Factory를 사용한 이유는 createProduct로 알맞은 Request DTO가 들어왔을 때 카테고리 분류에 따라서 concrete object를 생성하기 위함이었다. 서브 클래스 내부의 create 메소드는 따로 사용할 때가 있다고 판단해서 냅둔 것인데 이렇게 처리하는 것은 어쨋든 간 productFactory를 사용하는 게 아니라 subclass의 create 메소드가 노출될 확률이 있다고 생각한다.

또한 하위 클래스 내부에 validation 메소드를 집어 넣었는데 try를 통하여 exception을 캐치하는 것이 아니라 IllegalArgumentException을 따로 던져주는 것을 확인 할 수 있었다.

이 부분은 try-catch로 처리해야된다고 생각한다.

이 부분을 다시 리팩토링해보면 이렇게 될 것같다.

```java
// Subclass 
public static Product from(ProductRequestInfo dto) {
	validation(dto.getNaturalKey() ...);
	return Movie.builder()
	        .naturalKey(dto.getNaturalKey())
	        ...
	        .build();
}

// Factory
public static Product createProduct(ProductRequestInfo dto){
    Product product = null;
    try {
        if(isMovie("Movie", dto.getProductType())){
            product = Movie.from(dto);
        } 
        ...
    } catch (IllegalArgumentException e){
        System.out.println(e.getMessage());
    }
    return product;
}
```

다른 방법은 아예 Factory를 없애고, 추상 클래스에 `isMovie()`과 같은 메소드를 추가하여 서브클래스에서 구현한 뒤에 처리하는 방법도 있을 것 같다.

추상 클래스에 빌더 패턴을 적용하는 등 아쉬운 부분이 있지만, 이것은 지금 구현된 아키텍처에는 굳이 적용하지 않아도 될 부분이라고 생각하여 생략한다.

또한, TDD나 기타 등등 쓸 내용이 더 많지만, 제일 시간을 오래쏟고 고민했던 것들 위주로 정리해봤다.

그래도 나름 열심히 짜서 과제 전형에 합격해서 기분은 좋다 ㅎㅎ

![합격](https://user-images.githubusercontent.com/22961251/98634965-0da67000-231c-11eb-884d-d40a26cce4b3.png)

# STEP 4. REFERENCE

[일급 컬렉션 (First Class Collection)의 소개와 써야할 이유](https://jojoldu.tistory.com/412)

[일급 컬렉션을 사용하는 이유](https://woowacourse.github.io/javable/2020-05-08/First-Class-Collection)

[기본키는 무엇으로 할까 - 자연키, 인조키](https://multifrontgarden.tistory.com/180)

[JPA - 즉시 로딩과 지연 로딩(FetchType.LAZY or EAGER)](https://ict-nroo.tistory.com/132)

[JPA - @ManyToMany, 다대다[N:M] 관계](https://ict-nroo.tistory.com/127)

[JPA N+1 발생원인과 해결방법](https://www.popit.kr/jpa-n1-%EB%B0%9C%EC%83%9D%EC%9B%90%EC%9D%B8%EA%B3%BC-%ED%95%B4%EA%B2%B0-%EB%B0%A9%EB%B2%95/)

[JPA N+1 쿼리 문제와 해결](https://meetup.toast.com/posts/87)

[@ManyToOne의-N+1-문제-원인-및-해결](https://kapentaz.github.io/jpa/hibernate/@ManyToOne%EC%9D%98-N+1-%EB%AC%B8%EC%A0%9C-%EC%9B%90%EC%9D%B8-%EB%B0%8F-%ED%95%B4%EA%B2%B0/#)

[Hibernate LazyInitializationException 해결](https://uncle-bae.blogspot.com/2015/12/hibernate-lazyinitializationexception.html)
