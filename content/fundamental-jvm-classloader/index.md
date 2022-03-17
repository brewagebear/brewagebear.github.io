---
title: "Fundamental of JVM and Class Loader in java - Java JVM과 Class Loader의 동작 과정 이해"
date: 2020-12-29 19:30:00 +0900
tags:
  - Java
  - JVM
  - Core
emoji: 💻
author: 개발한입
categories: 개발
---

```toc
```

# 목차
- 개요
- STEP 1. Write Once, Run Anywhere(WORA)
- STEP 2. JVM 구조
    - STEP 2.1 클래스 로더 시스템 영역(Class Loader System Area)
        - STEP 2.1.1 클래스 로더의 특징
    - STEP 2.2 메모리 영역(Runtime Data Area)
    - STEP 2.3 실행 엔진(Excutable Engine)
    - STEP 2.4 클래스 로딩 과정(Class Loading Process)
        - STEP 2.4.1 동적로딩(Dynamic Loading)
- STEP 4. Implement class hot swap in java
- STEP 5. 결론
- STEP 6. Reference

# 개요

Fundamental이라고 적었지만, 저 또한 JVM의 모든 구조와 Class Loader의 동작방식을 100% 이해했다고는 장담을 못하는 상황입니다. 

이 포스팅은 아주 단순한 궁금증에서 출발했습니다.

제 궁금증은 `spring-boot-devtools` 와 같은걸 쓰면 정적페이지 수정이 있을 경우 바로바로 반영을 해서 뷰에서 뿌려줍니다.  근데 자바 코드의 경우에는 결국에는 `rebuild` 나 `recompile` 과 같은 행위가 있어야지 반영이 됩니다.

Java Class Hot Swap는 불가능한 것일까? 라는 의문에서 출발하게 됐습니다. 그렇게 의문을 쫓다보니 결국 JVM 구조와 그 내부에 속해있는 Class Loader에 대해서 이해를 했어야했습니다.

그 전에 자바의 목표인 WORA(Write Once, Run Anywhere)가 어떻게 가능했는지부터 출발하여

마지막은 Java에서 어떻게 HotSwap을 구현할 수 있을지에 대한 짧은 샘플코드로 마무리하고자 합니다.


# STEP 1. Write Once, Run Anywhere(WORA)

우리가 알고 있는 고급 프로그래밍 언어같은 경우에는 해당 코드를 기계어로 번역하기 위해서 컴파일러와 인터프리터를 사용하는 것으로 다들 알고 있을 것이다. 

아래는 컴파일러와 인터프리터의 기계어 번역과정을 나타낸 그림이다. 


<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103324819-dc574000-4a40-11eb-966e-a3abb05fe829.png">
</p>
<p align="center">
    <em>Aniket Thakur,difference between compiler interpreter,2013</em>
</p>

위 그림을 정리하자면 차이는 이렇다고 볼 수 있을 것이다.

- 컴파일러
    - 플랫폼 종속적(dependent)이다.
    - 소스코드를 한번에 번역을 한다.
    - 빠르다.
- 인터프리터
    - 플랫폼 비종속적(independent)이다.
    - `line-by-line` 으로 기계어 번역을 수행한다.
    - 느리다.

여기서 속도의 차이는 관점(런타임이냐 컴파일 시점이냐)에 따라 다른데 이 부분은 뒤의 JVM과 Class Loader를 설명하기위해 곁다리로 보는 부분이라 해당 부분은 설명이 매우 잘나와있는 링크로 대체하겠다. 

[컴파일러와 인터프리터 차이](https://blog.naver.com/ehcibear314/221228200531)

[인터프리터 & 혼합기법](https://gusdnd852.tistory.com/206)

위의 특징 중에서 눈 여겨야하는 키워드는 **플랫폼 종속적(dependent)이라는 것**이다. 

여기서 말하는 플랫폼은 OS나 코드가 돌아갈 환경이라고 생각하면 될 것이다. 

컴파일러는 플랫폼 종속적(dependent)하지만, 언어는 **플랫폼 비종속적(Independent)** 하다.

그러면 혹자들은 이렇게 말할 수도 있을 것이다.

> 어 내가 윈도우에서 만든 .exe 파일은 mac에서는 안돌아가잖아? 종속적인거 아냐?

여기서 핵심은 `.exe` 이다. 언어가 플랫폼에 종속적인 것이 아니라 **실행 파일(excutable)이 종속적일 수도 있고 아닐 수도 있는 것이다.  맥이든 리눅스든 윈도든 C자체를 사용하여 코딩할 수 있지 않는가?**

C는 이런 플랫폼에 맞는 컴파일러들을 제공하여 그 플랫폼에 맞는 기계어(정확히는 네이티브 코드)로 번역해서 실행파일을 만드는 것이다.

따라서, 기계어는 플랫폼 종속적이다라고 볼 수 있는데 해당 내용은 [If machine code is dependent on the hardware, why can compiled code be run on any platform with the same OS?](https://www.quora.com/If-machine-code-is-dependent-on-the-hardware-why-can-compiled-code-be-run-on-any-platform-with-the-same-OS) 에 자세히 답변이 되어있다.

하지만, 기계어 자체는 OS를 배제하고 바로 CPU에서 읽어 쓰는 개념이므로 앞으로는 **네이티브 코드**로 부르겠다. 

각설하고 자바가 강조하는 `Write Once, Run Anywhere` 를 자바는 어떻게 실현했는가? 를 다시 보자.

자바는 이를 **컴파일러와 인터프리터** 두 개 다 사용함으로써 극복해냈다.

사실 자바 컴파일러(javac)는 C의 gcc나 visual c와 같이 `excutable` 파일을 만드는 것이 목적이 아니다.

자바 컴파일러의 목적은 해당 소스코드들을 `JVM(Java Virtual Machine)` 이 이해할 수 있는 **자바 바이트코드(.class)** 로 변환하는 것이다.

플랫폼 종속적인 부분을 JVM을 통해서 해결하고자 한 것인데 자바 코드를 실행하고자하면 **JVM이라는 가상머신 위에서 돌아가서 플랫폼의 영향을 안받게** 하고자 한 것이다. 따라서, 자바라는 언어는 플랫폼은 비종속적이나 JVM에 종속적인 언어라 보는게 맞다고 생각한다.

근데 웃긴 것은 JVM 자체는 **플랫폼 종속적**이라는 것이다.

![Screen_Shot_2020-12-25_at_11 18 40_PM](https://user-images.githubusercontent.com/22961251/103324906-2dffca80-4a41-11eb-95e8-311f2fe7e85e.png)


Zulu의 JDK 다운로드 사이트이다. OS뿐만 아니라 Architecture에 따라 JDK가 다름을 볼 수가 있다.

예시는 이번 M1 맥북이 될 수 있을 것 같다. 같은 Mac OS여도 M1 맥북이냐 Intel 맥북이냐에 따라서 JDK도 다르게 받아야한다는 것이다. 

JVM 얘기하다가 왜 뜬금없이 JDK 얘기를 하는지 의아해할 수 있다. 

우리가 자바를 실행하기 위해서 사용하는 `JDK(Java Development Kit)` 안에는 JRE가 포함되어있는데 그 JRE안에 JVM이 포함되어 있다.

- JDK 컴포넌트

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103324933-42dc5e00-4a41-11eb-9742-edae34e4ec33.png">
</p>
<p align="center">
    <em><a href="https://www.inflearn.com/course/the-java-code-manipulation">백기선, 더 자바, 코드를 조작하는 다양한 방법, 2019</a></em>
</p>

모듈화 시스템이 도입됨에 따라 JRE가 모듈로 대체되긴했지만 이 부분은 나중에 JVM에 대해서 좀 더 깊게 다룰 때 얘기해보도록 하겠다.

각설하고, 즉, 플랫폼 종속적인 JDK를 받으면 해당 플랫폼의 네이티브 코드로 번역을 위한 JVM이 같이 들어가있다는 걸 알 수 있다.

자바의 목표인 WORA(Write Once, Run Anywhere)는 `자바 소스코드 → JVM (자바 바이트 코드) → 네이티브 코드 변환` 의 순서로 해당 목표를 실현해낸 것이다. 

따라서, 우리는 Java 코드를 작성하면 어떤 플랫폼이든 해당 플랫폼의 네이티브 코드로 변환을 해줄 수 있는 JVM만 있으면 돌아가는 것이다. 

그렇다면 Java에서 인터프리터를 사용하는 이유는 무엇일까?

인터프리터가 실질적으로 JVM에 저장된 **자바 바이트 코드를 네이티브 코드로 번역**하는 것이다.

지금까지 내용을 정리하자면 

`자바 소스코드 → 자바 컴파일러 → 자바 바이트 코드 → JVM → 자바 인터프리터 → 네이티브 코드` 

이런 순서가 된다고 알 수가 있다.

근데 웃긴 것은 방금 전에 간략하게 내가 인터프리터는 **느리다**고 얘기했다.

> 아 C에 비해 자바가 느리다는게 JVM 위에서 돌아가고 인터프리터까지 쓰기때문인가?

어느 정도 맞다고 볼 수 있다. 요즘 동작환경이 되는 시스템 사양자체가 성능이 뛰어나고, HotSpot VM과 같은 뛰어난 JVM을 통해서 극복을 해가고 있으며 점차 격차는 줄어들고 있지만 구조적 특성 상 미미한 차이지만 상대적으로 느린 것은 맞다. 사실 이 부분은 나보다 더 뛰어난 분이 분석을 해놨다.

[Java의 메모리 구조_기본 구조[1/3]](https://codevang.tistory.com/83?category=827598)

해당 포스팅은 3개의 시리즈 문서인데 1편이 아키텍처적인 부분을 다루고 있고, 관심이 있으면 다음 포스팅도 읽어도 도움이 매우 될 것이다. 하나하나 읽으면서 감탄사만 뱉었다.

근데 해당 포스팅을 보면 `자바 바이트 코드 → 기계어` 로 변환 시에 JIT컴파일러와 인터프리터를 쓴다고 하였다.

JIT 컴파일러는 왜 또 쓸까? 이것은 인터프리터의 성능을 조금이라도 더 올리기 위해서라고 생각하면 된다. 

인터프리터는 한줄씩 읽어 내려가면서 번역한다했는데 그러면 계속해서 **반복되는 구문을 불러들이는 경우**는 효율이 떨어지는 것이라 볼 수도 있을 것이다.

이때, JIT 컴파일러가 사용되는데 반복적인 코드는 JIT 컴파일러(바이트 코드 → 네이티브 코드)한테 보내서 미리 바꿔서 저장해둔다. 인터프리터는 해당 구문을 만나면 저장해둔 결과를 가져와서 네이티브 코드로 바꿔서 수행하는 로직을 수행한다.

자 이제, 어떤 방식으로 구동되는 지 이해했으니 JVM 구조와 Class Loader에 대해서 깊게 들어가보고자 한다.

# STEP 2. JVM 구조

위에서 자바 컴파일러의 역할은 `자바 소스코드(.java) → 자바 바이트코드(.class)` 로 바꾼 후에 JVM에 로딩한다고 말했었다. 이 자바 컴파일러에 의해 생성된 자바 바이트 코드를 JVM의 클래스 로더 시스템을 활용하여 메모리에 적재한 후에 실행 엔진에서 런타임 시 인터프리터와 JIT 컴파일러를 활용하여 실제 `자바 바이트 코드 → 네이티브 코드` 로 변경하여 실행한다고 보면 된다.

그림으로 보자면 다음과 같다고 볼 수 있다.


<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103324980-846d0900-4a41-11eb-9a9a-cfc9e16ce227.png">
</p>
<p align="center">
    <em>Benjamin J.Evans,Java Optimizing(O'Reilly Media,2019),49.</em>
</p>


정리하자면 아래의 순서를 따른다.

1. 실행될 클래스 파일을 메모리에 로드 후 초기화 작업 수행 
2. 메소드와 클래스 변수들을 해당 메모리 영역에 배치 
3. 클래스로드가 끝난 후 지역변수, 객체변수, 참조변수를 스택영역에 쌓음 
4. 다음 라인을 진행하면서 상황에 맞는 작업을 수행

이제 위의 과정을 좀 더 깊게 들여다 볼 시간이다.

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103325299-1c1f2700-4a43-11eb-8c3f-0c317a940a06.png">
</p>
<p align="center">
    <em><a href="https://www.inflearn.com/course/the-java-code-manipulation">백기선, 더 자바, 코드를 조작하는 다양한 방법, 2019</a></em>
</p>

JVM(Java Virtual Machine)은 위와 같은 구조로 설계되어있다.

하나씩 살펴보고자 한다.

## STEP 2.1 클래스 로더 시스템 영역(Class Loader System Area)

자바 바이트 코드를 읽고 메모리에 적재하는 역할을 수행하는데 메모리를 적재하는 과정은 크게 3개로 나뉜다.

- 로딩(loading) : 클래스를 파일에서 가져와서 JVM의 메모리에 로드한다.
- 링킹(linking) : 레퍼런스를 연결하는 과정
- 초기화(initialization) : `static` 한 값들을 초기화 한다.


<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103325319-30fbba80-4a43-11eb-9366-8ed89f68c6c3.png">
</p>
<p align="center">
    <em><a href="https://www.inflearn.com/course/the-java-code-manipulation">백기선, 더 자바, 코드를 조작하는 다양한 방법, 2019</a></em>
</p>

클래스가 실질적으로 적재되는 순서는 `로딩 → 링킹 → 초기화` 순서로 진행된다.

자바의 동적로딩이 가능한 이유가 바로 이 클래스 로더 때문이기도 하다.

해당 프로세스를 보기 전에 로딩 아래 놓여져 있는 `Bootstrap, Extenstion, Application`과 같은 키워드를 이해해야할 필요가 있다.

해당 키워드들은 클래스 로더의 종류를 나타낸다고 볼 수 있다.

화살표 순서대로 순차적으로 실행된다.

`BootStrap Class Loader → Extension Class Loader → Application(=System) Class Loader`

자바는 확장성이 좋은 언어다보니 직접 클래스 로더를 구현해서 사용할 수 있다. 이러한 것들을 사용자 정의 클래스로더(User-Defined Class Loader)라 부르며, 이런 클래스 로더들은 **Application Class Loader** 이후에 로딩된다.

실질적인 구조는 아래와 같이 되어 있다.

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103325493-fa726f80-4a43-11eb-8849-5ef3218c9c41.png">
</p>
<p align="center">
    <em><a href="https://resian-programming.tistory.com/63">Resian, ClassLoader의 특징과 종류, 2020</a></em>
</p>

이 화살표는 **상속 관계**를 나타낸 것이므로 로딩 순서는 역순이라는 것을 잊으면 안된다. 

> 상속이라 했는가?

맞다. 클래스 로더는 계층적 구조를 갖고 있는데 잠깐 클래스 로더의 특징을 살펴보자.

### STEP 2.1.1 클래스 로더의 특징(Class Loader's feature)

클래스 로더의 특징

- 클래스 로더는 계층적(Hierarchical)이다.
- 클래스 로더는 가시적인 규약(Visibility Constraint)을 갖고 있다.
- 클래스 로더는 위임형 로드 요청(Delegate Load Request)의 특징을 갖고 있다.
- 클래스 로더에 로드된 클래스는 언로드가 불가능하다.

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103325331-496bd500-4a43-11eb-9f95-b2c59a7f419a.png">
</p>
<p align="center">
    <em><a href="https://engkimbs.tistory.com/606">새로비, Java 클래스 로딩 과정, 2018</a></em>
</p>

**클래스 로더는 계층적이다.**

위의 그림과 같이 최상위 부모클래스는 BootStrap Class Loader이고, 그 밑에 부모-자식 관계를 갖고 있다.

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103325493-fa726f80-4a43-11eb-8849-5ef3218c9c41.png">
</p>
<p align="center">
    <em><a href="https://resian-programming.tistory.com/63">Resian, ClassLoader의 특징과 종류, 2020</a></em>
</p>

**클래스 로더는 가시적인 규약을 갖고 있다.**

여기서 말하는 가시적인 규약은 일련의 규칙을 갖고 있다고 생각해도 될 것 같다. 그 규칙은 다음과 같다.

- 자식 클래스 로더에서 찾지 못한 클래스 → (위임) 부모 클래스 로더에서 찾을 수 있음.
- 부모 클래스 로더에서 찾지 못한 클래스 → 자식 클래스 로더에서 찾을 수 없음.

즉, 하위 클래스 로더는 상위 클래스 로더의 Class를 위임형 로드 요청(Delegate Load Request)를 통해서 찾을 수 있지만 반대는 불가능하다.

또한 상위 클래스 로더가 같은 하위 클래스는 서로 로딩한 클래스를 사용할 수 없다는 룰을 가시적인 규약이라 한다.

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103325489-f8a8ac00-4a43-11eb-982a-ec379b1f8574.png">
</p>
<p align="center">
    <em><a href="https://resian-programming.tistory.com/63">Resian, ClassLoader의 특징과 종류, 2020</a></em>
</p>


**클래스 로더는 위임형 로드 요청(Delegate Load Request)의 특징을 갖고 있다.**

상위 클래스 로더가 로딩한 클래스가 우선권을 갖는 것을 위임형 로드 요청이라 한다.

**클래스 로더에 로드된 클래스는 언로드가 불가능하다.**

클래스 로더에는 클래스 언로딩(Unloading) 기능이 없다. 따라서, 언로딩을 하기 위해서는 Class Loader 자체를 삭제하고 재생성해야된다.

다음으로는 JVM의 나머지 구조인 **메모리** **영역**과 **실행 엔진**에 대해서 알아보자.

## STEP 2.2 메모리 영역(Runtime Data Area)

JVM이 운영체제 위에서 실행되면서 할당받는 메모리 영역으로, Class Loader에서 준비한 데이터들을 보관한다. 메모리 영역은 크게 모든 쓰레드가 공유하는 영역과 쓰레드별로 하나씩 생성되는 영역으로 나뉘어진다.

1. 모든 쓰레드가 공유하는 영역
    - 메소드 영역(Method Area)
    - 힙 영역(Heap Area)
2. 쓰레드 별 하나씩 생성되는 영역
    - 스택 영역(Stack Area)
    - 네이티브 메소드 영역(Native Method Area)
    - PC 레지스터(Program counter Register)

밑에서는 위의 영역들을 하나씩 살펴보고자 한다. 

**메소드 영역** 

- 클래스 수준의 정보 (클래스 이름, 부모 클래스 이름, 메소드, 변수) 저장하는 영역이다.

메소드 영역은 사실 클래스 영역(Class Area)이라고도 부르고 정적 영역(Static Area)라고도 부른다.

클래스 수준의 정보가 저장된다는 뜻은 **클래스 파일의 바이트 코드가 로드 되는 곳**이라고 생각하면 된다.

즉, JVM이 시작될 때 생성되는 영역이며 JVM이 읽어 들인 각각의 클래스와 인터페이스에 대한 정보들이 보관된다.

**힙 영역**

- 힙 영역에는 객체를 저장하는 영역이다.

즉, `Person person = new Person();` 을 수행하면 해당 인스턴스 변수가 놓이는 영역이다.

생성이 된 인스턴스는 가비지 컬렉터에 의해 지워지거나 JVM이 종료될 때까지 힙 영역에 남아있게 된다.

**스택 영역**

- 쓰레드 마다 런타임 쓰레드를 만들고  그 안에 메소드 호출(Method Call)을 스택 프레임이라 부르는 블럭으로 쌓는다. 쓰레드 종료하면 런타임 스택도 사라진다.

**PC 레지스터** 

- 쓰레드 마다 쓰레드 내 현재 실행할 스택 프레임을 가르키는 포인터가 생성된다.

**네이티브 메소드 스택** 

네이비티브 메소드 스택이란 자바 외의 언어로 작성된 네이티브 코드를 위한 스택이다. 이 때, 네이티브 메소드 인터페이스를 통해 호출하는 코드들을 위한 스택이라고 생각하면 될 것같다.

- 쓰레드 마다 생성되며 네이티브 메소드 사용시 별도로 생성되는 스택

    →  예시) `Thread.currentThread()` 

![native method](https://user-images.githubusercontent.com/22961251/103325596-49b8a000-4a44-11eb-85aa-50da8499f074.png)

위와 같이 `native` 키워드가 붙은 것들이 네이티브 메소드들이라고 보면 될 것 같다.

## STEP 2.3 실행 엔진(Execution Engine)

클래스 로더를 통해 JVM 내 런타임 데이터 영역에 배치된 바이트코드들이 실제 실행되기 위해 사용되는 영역

### 인터프리터

- 자바 바이트 코드를 한 줄씩 실행

이 때문에 느린 부분이 있는데 단점을 보완하기 위해서 JIT 컴파일러 사용

### JIT 컴파일러

- 인터프리터의 단점을 보완하기 위해 도입되었다.

반복적인 코드는 JIT 컴파일러(바이트 코드 → 네이티브 코드)한테 보내서 미리 바꿔서 저장해둔다. 인터프리터는 해당 구문을 만나면 저장해둔 결과를 가져와서 네이티브 코드로 바꿔서 수행한다.

참고로 JIT 컴파일러가 컴파일하는 과정은 당연히 컴파일러다 보니 하나씩 인터프리팅하는 것보다 느리다. 따라서, 자주 수행되는 수행 여부 체크와 이 코드가 어느정도 반복됐는지 여부 등을 체크하여 컴파일을 수행한다.

### GC(Garbage Collector)

- 애플리케이션이 생성한 객체의 생존 여부를 판단하여 더 이상 사용되지 않는 객체를 해제하는 방식으로 메모리를 자동 관리함.

GC는 나중에 따로 포스팅을 해보고자 한다.

자 이제 JVM의 큰 덩어리들은 훑어봤다고도 할 수 있다. 이제 실질적으로 바이트 코드가 어떻게 로드되서 동작하는지 지금까지의 개념을 토대로 생각해보자.

## STEP 2.4 클래스 로딩 과정(Class Loading Process)


<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/103325319-30fbba80-4a43-11eb-9366-8ed89f68c6c3.png">
</p>
<p align="center">
    <em><a href="https://www.inflearn.com/course/the-java-code-manipulation">백기선, 더 자바, 코드를 조작하는 다양한 방법, 2019</a></em>
</p>

**로딩(Loading)**

클래스 로더가 바이트 코드를 읽고 그 내용에 따라 적절한 바이너리 데이터를 만들고 메소드 영역에 저장한다. (JVM의 메모리에 로드한다고 보면 된다.)

이때 메소드 영역에는 다음과 같은 데이터들이 저장된다.

- FQCN(Fully Qaulified Class Name)
- 클래스인지 인터페이스인지 이늄인지 여부
- 메소드와 변수

로딩을 하고 나면 해당 클래스 타입의 `Class<?>` 객체를 생성하여 힙 영역에 저장한다.

**링킹(Linking)**

링킹은 세가지 단계로 나뉘어진다.

1. 검증(Verifiy) 
2. 준비(Prepare)
3. 분석(Reslove) 

검증 : `.class` 파일 형식이 유효한지 검증한다.

준비 : 메모리를 준비하는 과정으로 `static` 변수와 기본 값에 필요한 메모리를 준비

분석 : 심볼릭 메모리 레퍼런스를 메소드 영역에 있는 실제 레퍼런스로 교환한다.***(optional)***

여기서 심볼릭 메모리 레퍼런스는 클래스가 로드가 되면 실제 힙영역의 레퍼런스 영역을 가르키는 것이 아니라 논리적인 주소만 가르키고 있는 것을 뜻한다. 이를 Resolve 단계에서 실제 힙 영역의 레퍼런스를 가르키게 한다.

이제 각 과정을 배웠으니 실질적으로 동적 로딩이 어떤 식으로 이뤄지는 지 보자.

포스팅 중간 중간에 동적 로딩(Dynamic Loading)이 계속해서 나온 것을 알 수 있다.

당최 동적 로딩이란 무엇일까?

지금까지 공부했던 내용으로 총 정리를 해보자.

1. 자바 컴파일러(javac)가 자바 소스코드(`.java`)를 자바 바이트 코드(`.class`)로 컴파일한다.
2. **Class Loader**를 통해서 Class 파일을 JVM으로 로딩한다.
3. 로딩된 자바 바이트 코드들을 실행 엔진(Excution Engine)이 해석한다.
4. 해석된 바이트 코드는 메소드 영역(Runtime Data Area)에 배치되서 실질적으로 돌아간다.

이번에 집중적으로 분석해볼 구간은 2번이라고 보면 될 것 같다.

클래스 로더는 두 가지 방식으로 클래스를 로딩한다.

1. **로드타임 동적 로딩(load-time dynamic loading)**
2. **런타임 동적 로딩(run-time dynamic loading)**

이를 좀 더 깊게 다뤄보고자 한다.

## STEP 2.4.1 동적로딩

자바는 동적으로 클래스 로더를 통해서 클래스를 읽어 들인다. 이 과정은 런타임에 이뤄진다.

런타임에 동적으로 클래스를 로딩하는 것은 JVM이 클래스에 대한 정보를 갖고 있지 않다는 것을 의미한다. 

즉, JVM은 이 클래스가 유효한지를 로딩할 때 판단해야 된다. JVM은 내부적으로 클래스를 분석할 수 있는 기능을 갖고 있으며 개발자들은 이것을 리플렉션(**Reflection**)을 통해서 분석을 할 수 있다.

### STEP 2.4.2 로드타임 동적 로딩(load-time dynamic loading)

```java
import java.lang.*;
public class HelloWorld {
     public static void main(String[] args) {
        System.out.println("안녕하세요!");
     }
  }
```

해당 `HelloWorld` 클래스를 실행하였다 가정해보면, 명령행에서는 다음과 같이 입력이 될 것이다.

```bash
$java HelloWorld
```

이 경우에 JVM이 시작되고 클래스로더가 생성되면서 코드를 수행하기 위한 과정이 수행될 것이다.

제일 먼저 우리가 알고있는대로 `BootStrap ClassLoader` 가 생성되며 `Object` 클래스를 읽어온다.

그 이후에 `HelloWorld` 클래스를 로딩하기 위해서 해당 클래스의 바이트 코드를 읽어온다.

이 때, `java.lang.String` 과 `java.lang.System`같은 클래스가 필요할 것이다.

이 두 개의 클래스는 `HelloWorld` 클래스가 로드되는 시점에서 로드된다.

즉, 다른 클래스를 읽어오는 과정에서 함께 로딩되는 것을 **로드타임 동적 로딩**이라고 한다. 

### STEP 2.4.3 런타임 동적 로딩(load-time dynamic loading)

```java
public class HelloWorld1 implements Runnable {
     public void run() {
        System.out.println("안녕하세요, 1");
     }
  }

public class HelloWorld2 implements Runnable {
     public void run() {
        System.out.println("안녕하세요, 2");
     }
  }
```

위의 코드를 활용해서 런타임 동적 로딩의 과정을 알아보자.

```java
public class RuntimeLoading {
     public static void main(String[] args) {
        try {
           if (args.length < 1) {
              System.out.println("사용법: java RuntimeLoading [클래스 이름]");
              System.exit(1);
           }
           Class klass = Class.forName(args[0]);
           Object obj = klass.newInstance();
           Runnable r = (Runnable) obj;
           r.run();
        } catch(Exception ex) {
           ex.printStackTrace();
        }
     }
  }
```

위 코드에서 `Class` 객체를 `forName()` 메소드를 통해서 찾은 후에 `Class` 객체로 매핑하는 것을 확인할 수 있다. 이러한 행위들이 리플렉션 API를 통해서 이뤄진다. `forName()` 메소드를 통하여 클래스 객체를 가져 온 후

필드 값이나 메소드 이름, 어노테이션 등의 정보를 가져올 수 있다.

리플렉션은 포스팅을 할지 안할지는 모르겠지만 일단 넘어가고 대충 `main(String[] args)` 로 넘어온 인자의 값을 통해서 클래스 서칭을 하여 클래스 객체를 로딩한다고 이해하면 된다.

`Object obj = klass.newInstance()` 구문을 보면 인자로 넘어온 클래스를 인스턴스화하는 것을 알 수 있다.

대충 예시는 이렇게 볼 수 있을 것 같다.

```java
Class klass = Class.forName("java.lang.Integer");
Object obj = klass.newInstace();
```

여기서 눈치를 챘을 수도 있다. 즉, `forName()` 메소드를 통해 어떤 인자가 들어오는 지에 따라 로드되는 클래스가 달라진다는 점이다. (어떤 클래스를 참조하는 지 알 수 없다.) 

실질적인 클래스가 참조되는 시점은 `main()` 메소드가 수행되고 `Class.forName(args[0])` 을 호출하는 순간 결정된다는 것이다.

이렇게 클래스를 로딩할 때가 아닌 **코드를 실행하는 순간에 클래스를 로딩하는 것을 런타임 동적 로딩**이라 한다.

> 아니 그래서 자바 코드 핫스왑은 어떻게 구현하는데?

이정도까지 읽으면서 따라오신 분들은 핫스왑은 다음과 같은 방식으로 자바에서 구현이 가능할 수 있다.

1. **Class Loader 구현을 통한 Hot Swap**
2. **바이트코드 조작을 통한 Hot Swap**

1번의 아이디어는 다음과 같다. 런타임 시 로드된 클래스의 변경이 있을 경우 로드된 파일로 다시 클래스 로더에 올리는 방식이다. 하지만 이거와 같은 경우는 문제가 좀 있다.

일단, 위의 클래스 로더 특징을 통해 말했듯이 Java Class Loader는 언로딩(Unloading) 기능이 존재하지 않는다.

극단적으로는 `클래스 파일이 변경 → 클래스 로더 삭제 → 재생성 → 클래스 로더` 이러한 방식을 취해야할 것이다.

물론 1개의 클래스 변경된 상태에서 로더를 삭제하고 올리는 것은 상관이 없을 수 있다. 그러나, 상속관계를 생각하고 거기다가 어노테이션까지 생각하면 매우 복잡해질 문제가 될 수 있다.

실행엔진 부분도 문제가 된다. 인터프리팅이나 JIT 컴파일러를 사용할 때 JIT 컴파일 전에 최적화 하느라 메소드 호출 부분을 실제 코드로 바꿔준다. 잘 생각해보자. 메소드가 추가되면 해당 메소드와 동일한 이름을 가진 메소드가 존재하는지 존재유무 파악이랑 상위클래스도 뒤져야하고 생각보다 매우 복잡한 작업이 될 것이다. 

이러한 방식은 성능과 복잡도에서 비용이 매우 비싸다고 볼 수 있다. 

이는 개인적인 의견이므로 사람마다 의견이 다를 것이라고 생각한다.

Jrebel 블로그에 자세히 나와있는데 이 부분을 참고하면 도움이 될 것 같다.

[how-to-use-java-class-loaders](https://www.jrebel.com/blog/how-to-use-java-class-loaders)

[how-do-classloader-leaks-happen](https://www.jrebel.com/blog/how-do-classloader-leaks-happen)

[java-hotswap-guide](https://www.jrebel.com/blog/java-hotswap-guide)

2번의 아이디어는 다음과 같다. 언로드가 안된다면 로드된 바이트코드를 뜯어서 변경된 걸로 교체하면 되는거 아닌가? 에서 출발했다고 볼 수 있다. 즉, 변경점을 추적해서 변경 클래스 파일의 바이트 코드 자체를 변경해버리면 이미 로드가 되어있어도 변경된 바이트 코드로 동작하니까 말이다. 

바이트코드를 조작하는 방식은 다양하게 존재하는데

1. `.class` 내용을 변경하여 조작

    → instance 로드할 때 기존 바이트코드의 정보가 메모리에 올라가있으므로 

    `.class` 파일의 바이트코드 변경 후 동작하는 소스를 실행토록 해야함.

2.  클래스를 로딩할 떄 바이트코드를 조작하여 메모리에 적재

    → 코드의 순서에 종속되는 문제가 있다. 

    다른 클래스에서 이미 해당 인스턴스를 메모리에 올렸을 경우, 바이트코드가 변경되지 않고 올라갈 수 있다.

3. javaagent를 활용하여 클래스 로드 시 바이트코드를 변경하여 메모리에 적재

바이트 코드 조작의 기술은 코드 커버리지 도구나 프로파일러 그리고 핫스왑 기능을 제공해주는 라이브러리들도 사용하는 기술이라고 보면 된다.

핫스왑을 지원하는 도구들은 1번과 2번의 아이디어와 더불어 자체적인 아이디어를 통해서 이러한 핫스왑 기능을 지지원한다. 대표적인 도구들은 다음과 같다. 

[jrebel](https://www.jrebel.com/products/jrebel)

[spring-loaded](https://github.com/spring-projects/spring-loaded)

[dcevm](https://github.com/dcevm/dcevm) +
[HotswapAgent](https://github.com/HotswapProjects/HotswapAgent)

spring-loaded의 경우에는 오픈소스로 풀려있어서 소스를 까볼 수가 있는데 ASM이라는 기술을 사용한다.

사용하기에 매우 복잡한 바이트코드 조작 라이브러리라 볼 수 있다. 요즘은 바이트버디(ByteBuddy)라고 조금 더 쉽게 바이트 코드 조작을 할 수 있는 라이브러리도 등장했다.

사실 상용으로 쓰이고 많이 쓰이는 자바 핫스왑 제품들 같은 경우에는 구현 자체가 매우 복잡한데 내가 예제로 다뤄볼 코드는 그냥 클래스 리로딩이라고 보는게 적합해보인다.

즉, 핫스왑 구현이라는 말은 거창하고 그냥 아 이렇게 로드된 클래스를 바꿀 수 있구나 정도만 봐도 될 것 같다.

예제를 다룰 내용은 1번과 2번에 대해서 간략하게 봐보고 클래스 리로딩 예제들을 조금 다뤄볼 예정이다.

# STEP 4. Implement class hot swap in java

## STEP 4.1 Class Loader를 통한 Hot Swap 예제

이 부분은 다른 블로거분(DEV 용식님)께서 직접 다룬 내용이 있다.

[URLClassLoader를 사용 한 class hot deploy (실패)](https://devyongsik.tistory.com/274) 은 실패사례라 보면 될 것이다.

[[JAVA] 클래스 hot deploy #2](https://devyongsik.tistory.com/276) 은 성공사례이다.

자세한 내용은 해당 블로그를 참고하는게 더 도움이 될 것이라고 생각한다.

나는 간략하게 실패사례에서 실패했던 이유와 성공사례와 그리고 회고에 대해서 설명하고자 한다.

실패 사례의 아이디어를 보자면 아주 단순하였다.

Class Loader를 통하여 로드된 클래스는 **unload**가 불가능하니 `URLClassLoader` 를 사용하여 **Class Loader**를 새로 생성하여 클래스를 동적으로 로딩하자! 가 아이디어라 볼 수 있을 것이다.

하지만 우리는 클래스로더의 특징을 알고 있다.

이 실패사례는 큰 문제점을 갖고 있는데 바로 **위임형 로드 요청의 특징을 간과했다는 점**이다.

새로운 `URLClassLoader` 를 생성해봐야 `Application ClassLoader` 에게 클래스 로딩을 위임하기 때문에 실패한 사례이다.

여기서 DEV 용식님께서는 포기하지 않으시고 새로운 방법을 도출해낸다.

> 아 그러면 내가 생성한 `ClassLoader` 를 통해 Load하면 클래스를 동적르로 변경된 내용을 적용할 수 있겠네

라고 말이다.

그것이 바로 성공사례이다. 

즉, 클래스패스에 있는 클래스는 이미 `Application ClassLoader` 가 클래스를 로딩한 상태이기 때문에 하위 클래스 로더에서 아무리 바꿔치기해도 영향이 가지를 않으므로, `User-Defined ClassLoader` 가 물고 올라가도록 하는 것이다. 

이 성공사례를 보면 해당 클래스패스에 파일을 두지 않고, 다른 위치에 클래스를 둔 뒤에 자신이 만든 클래스로더에 변경한 클래스를 컴파일 하면 해당 바이트코드를 물고 들어오면서 변경된 내용이 콘솔로 찍힌다.

회고한 부분에도 적혀있지만, 이렇게 구현을 했다 한들 클래스 로더가 하나의 클래스만 로딩하는 상태가 아닐 뿐더러 클래스가 바뀔때 마다 클래스 로더를 삭제후 재생성하는 부분은 비효율적이라고 생각한다고 적혀있다.

해당 부분은 나도 비효율적이라고 생각이 들어서 좀 더 다른 예제들을 찾아보게 되었고 비슷한 예제가 담긴 아티클을 발견하게 되었다.

[java-wizardry-101-a-guide-to-java-class-reloading](https://www.toptal.com/java/java-wizardry-101-a-guide-to-java-class-reloading)

예제 2번이 매우 비슷한 예제임을 알 수가 있는데 실제로 구동해보면 아래와 같은 결과가 나온다.

![hot-swap example](https://user-images.githubusercontent.com/22961251/103325714-e7ac6a80-4a44-11eb-86db-d731546160d4.png)

2번 예제는 `DynamicClassLoader` 를 만들어서 처리하는 데 런타임 시에 소스코드에 변화를 주고 컴파일을 하면 위와 같이 변경된 바이트 코드로 동작하는 모습을 볼 수가 있다.

단점이라고 하는 부분이 불러올 때마다 새로운 클래스로더가 생성되는 부분인데 이때 새로운 클래스로더가 생성되면서 **Unlink 되므로** 가비지 콜렉터가 처리를 해준다고 한다. 삭제 ↔ 재생성 반복의 코스트는 줄일 수 있으나 GC가 해당 Unlink된 것들에 대한 처리를 하게될텐데 효율이 얼마나 좋을지는 잘 모르겠다.

이 아티클의 다른 예제도 돌려볼만하다고 생각한다.

특히, 마지막 예제는 실제 웹 어플리케이션에서도 사용할 수 있을만한 예제를 다루고 있다.

2번 예제 얘기로 돌아와, 런타임 시에 바뀐 코드로 동작하는 것을 알 수가 있었다.

하지만, 이 예제의 경우에도 소스를 바꾸면 컴파일을 해야 된다는 단점이 있다. 

`DynamicClassLoader` 의 경우에 `target/classes` 의 자바 바이트코드를 읽어 들이기 때문에 우리가 소스를 수정하면 컴파일을 해줘야한다.  뭐 이 부분도 리플렉션 처리를 통해서 변경사항을 추적 후 JVM 상 바이트코드와 비교해서 변경사항이 있으면 사용자가 만든 로더단에서 컴파일을 해서 올릴 수 있도록 가능할 것 같다.

## STEP 4.2 바이트코드 조작을 통한 Hot Swap 예제

많은 블로그에서 Java의 핫 스왑을 위해서 DCEVM과 HotswapAgent를 사용하는 케이스를 보았다.

DCEVM 공식페이지의 소개글을 보면 다음과 같이 소개하고 있다.

> The Dynamic Code Evolution Virtual Machine (DCE VM) is a modification of the Java HotSpot™ VM that allows unlimited redefinition of loaded classes at runtime. The current hotswapping mechanism of the HotSpot™ VM allows only changing method bodies. Our enhanced VM allows adding and removing fields and methods as well as changes to the super types of a class.

단순하게 말하자면 요즘 많이 쓰는 HotSpot VM과 같은 JVM은 핫스왑 매커니즘이 메소드 바디만 변경되는거만 허용하는데 우리는 필드나 메소드 변경이나 삭제 추가등에 대응되어 있다고 되어있다. 아예 JVM을 이걸로 대체해서 쓰는건지 아니면 HotSpot VM과 같이 쓰는지 궁금해서 관련 자료를 계속 찾아봤는데 딱히 제대로 나오는 것은 없었다.

아무튼 이 `DCEVM`이라는 놈은 주로 `HotSwapAgent`라는 놈과 함께써서 핫스왑을 수행한다.

VM의 옵션값으로 넣는 걸 보면 대충 동작과정을 얼추 알 수는 있을 거 같다.

자바 8에서 사용할때는 이러한 옵션을 추가해서 사용한다.

```
-XXaltjvm=dcevm -javaagent:hotswap-agent.jar
```

대충 보면 JVM은 dcevm으로 대체하고 (위에도 언급했지만 동작과정에 대한 정확한 설명이 없으므로 뇌피셜이다.) `javaagent` 를 `hotSwapAgent` 로 엮어서 사용하는 거 같다. 

`javaagent`를 간략하게 설명을 하자면, JVM에서 동작하는 Java 어플리케이션으로써 JVM의 다양한 이벤트를 전달 받거나 정보 질의, 바이트코드 조작등을 특정 API를 통하여 수행할 수 있는 도구이다.

우리가 많이 쓰는 Lombok이나 JPA의 다이나믹프록시 또한 바이트코드 조작을 통해 수행되는데 이때 ByteBuddy나 javaagent와 같은 도구들을 사용한다.

이 내용은 나중에 어노테이션 프로세서나 JPA 다이나믹프록시 관련한 포스팅으로 다시 다뤄보고자한다.

자 이제 `ByteBuddy` 와 `javaagent` 를 통한 간단한 예시를 보고 끝마치도록 하겠다.

해당 내용은 백기선님의 더 자바, 코드를 조작하는 다양한 방법의 예시 코드이다.

```java
// Moja.class
public class Moja {
 
    public String pullOut() {
        return "";
    }
}

// Masulsa.class
import net.bytebuddy.ByteBuddy;
import net.bytebuddy.implementation.FixedValue;
 
import java.io.File;
import java.io.IOException;
 
import static net.bytebuddy.matcher.ElementMatchers.named;
 
public class Masulsa {
 
    public static void main(String[] args) {
        try {
            new ByteBuddy().redefine(Moja.class)
                    .method(named("pullOut")).intercept(FixedValue.value("Rabbit"))
                    .make().saveIn(new File("/Users/dailyworker/workspace/study/build/classes/java/main/"));
        } catch (IOException e) {
            e.printStackTrace();
        }
 
        System.out.println(new Moja().pullOut());
    }
}
```

분명 우리 `Moja` 클래스에는 아무런 값을 리턴하지않지만, JVM에 로딩된 바이트 코드를 `ByteBuddy` 를 통해서 조작하는 방식의 코드이다.

`ByteBuddy().redefine(Moja.class).method(named("pullOut")).intercept(FixedValue.value("Rabbit"))`

이게 핵심 코드라 볼 수 있는데 메소드의 이름이 `pullOut()` 인 것을 인터셉트해와서 `FiexedValue` 로 밸류를 강제로 집어넣고 `redefine` 을 통해서 클래스를 재정의한 방식이라 볼 수 있다.

근데 이 방식도 우리가 위에서 클래스 로더를 통해서 작업했던거 마냥 단점이 있다.

일단 먼저 ByteBuddy를 통하여 클래스 재정의 부분을 수행한 후에 해당 바이트코드를 주석처리나 제거를 한 후에 `pullOut` 을 호출해야된다. 

이렇게 하는 이유는 DEV 용식님의 실패사례를 설명했던 것과 동일한데, 이미 메모리 로딩된 원본 모자 클래스를 참조해 실행하기 때문에 변경된 클래스 파일을 참조하지 않기 떄문이다.

이것도 결국에는 바이트코드가 조작된 클래스를 불러오고 싶다면 **클래스로더에 클래스를 올리기 전 시점에 조작**해야된다는 불편함이 있다.

이런 불편함을 바로 `javaagent` 를 통해서 극복할 수 있다.

```java
public class MasulsaAgent {
      public static void premain(String agentArgs, Instrumentation inst){
          new AgentBuilder.Default()
                  .type(ElementMatchers.any())
                  .transform(new AgentBuilder.Transformer(){
 
                      @Override
                      public DynamicType.Builder<?> transform(DynamicType.Builder<?> builder, TypeDescription typeDescription, ClassLoader classLoader, JavaModule javaModule) {
                          return builder.method(named("pullOut")).intercept(FixedValue.value("Rabbit"));
                      }
                  }).installOn(inst);
      }
  }
```

`javaagent`는 `premain()` 메소드를 지원하는데 해당 메소드를 통해서 JVM의 실행가능한 최초 진입점인 `main()` 을 가로챌 수 있다. 이때, `ByteBuddy` 가 제공해주는 `agentBuilder` 를 통해서 다시 위에서 했던 로직을 진행한다.

`pom.xml` 에는 다음과 같은 옵션이 추가로 필요하다.

```xml
<plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-jar-plugin</artifactId>
        <version>3.2.0</version>
        <configuration>
          <archive>
            <index>true</index>
            <manifest>
              <addClasspath>true</addClasspath>
            </manifest>
            <manifestEntries>
              <mode>development</mode>
              <url>${project.url}</url>
              <key>value</key>
              <Premain-Class>com.theJava.MasulsaAgent</Premain-Class>
              <Can-Redefine-Classes>true</Can-Redefine-Classes>
              <Can-Retransform-Classes>true</Can-Retransform-Classes>
            </manifestEntries>
          </archive>
        </configuration>
      </plugin>
```

여기서 다른 것보다 `<Premain-Class>` 와 `<Can-Redefine-Classes>`  그리고 `<Can-Retransform-classes>` 이 세 옵션을 주목하면 된다.

그 후에 `mvn clean pakaging` 을 통해서 패키징을 수행한 뒤에 `javaagent` 를 우리가 만든 Jar파일에 등록을 한다.

VM option에 해당 Jar 파일 경로로 등록한다.

```bash
-javaagent:{Jar File Path}
```

이렇게 함으로써 클래스 로딩과 독립적으로 Class를 재정의하는 등 바이트코드 조작이 가능함을 알 수가 있다.

이런 javaagent는 위에서도 말했듯이 Lombok 같은 어노테이션 프로세서나 다이나믹 프록시, 코드 커버리지 툴 등 다양한 방면에서 사용되고 있다.

# STEP 5. 어떤 핫스왑 도구를 사용할까?

위에서 다양한 핫스왑 도구들이 존재한다고 하였다.

그렇다면 우리가 실제 코딩을 할 때 어떠한 핫스왑 도구를 사용하는게 좋을까?

무엇이 됐던간에 제일 중요한 건 핫스왑 도구들의 한계를 알아야하는 것이 중요하다고 생각이 든다.

핫스왑에이전트의 Feature부분을 살펴보자. 

[http://hotswapagent.org/#features](http://hotswapagent.org/#features)

> The only unsupported operation is hierarchy change (change the superclass or remove an interface).

다른 핫스왑 도구인 spring-loaded 같은 경우에도 한계점이 있을까?

> Q. Does it reload anything that might change in a class file?

> A. No, you can't change the hierarchy of a type. Also there are certain constructor patterns of usage it can't actually handle right now.

여기에도 명시가 되어있다.

즉, 한계점을 알고 핫스왑 도구를 사용했을 때 발생할 수 있는 일에 대해서 대처를 할 수 있으면 사용하는 것이 맞다고 생각이 드나 무작정 편하다고 한계점과 어떤 핫스왑 기능들을 제공하는지 모른채로 사용한다면 오히려 디버깅이나 해당 도구를 사용했을 때 개발하는데 어려움이 생길 수 있다고 본다. 

# STEP 6. 결론

JVM 구조부터 시작하여 클래스 핫스왑 예제까지 살펴보았다.

JVM 구조에서 힙이나 스택, PC에 관한 내용이나 GC에 대한 내용은 추후에 따로 포스팅을 해서 다뤄볼 예정이다.

# STEP 7. Reference

1. [Inflearn - 더 자바, 코드를 조작하는 다양한 방법](https://www.inflearn.com/course/the-java-code-manipulation)
2. [JVM Internal - Naver D2](https://d2.naver.com/helloworld/1230)
3. [Java 클래스 로딩 과정 - 새로비](https://engkimbs.tistory.com/606)
4. [자바 동적로딩 이해(델리게이션 모델) - 미래학자](https://futurists.tistory.com/43)
5. [Java 클래스로더 훑어보기 - HomoEfficio](https://homoefficio.github.io/2018/10/13/Java-%ED%81%B4%EB%9E%98%EC%8A%A4%EB%A1%9C%EB%8D%94-%ED%9B%91%EC%96%B4%EB%B3%B4%EA%B8%B0/)
6. [컴파일러와 인터프리터 차이 - 얏구](https://blog.naver.com/ehcibear314/221228200531)
7. [https://blog.wanzargen.me/16?category=700063](https://blog.wanzargen.me/16?category=700063)
8. [자바의 메모리 구조 - 1. 메소드 영역 - WANZARGEN](https://blog.wanzargen.me/17?category=700063)
9. [ClassLoacer의 특징과 종류 - Resian](https://resian-programming.tistory.com/63)
10. [자바 클래스 로딩, 그리고 리플렉션 - agugu95](https://velog.io/@agugu95/%EC%9E%90%EB%B0%94-%ED%81%B4%EB%9E%98%EC%8A%A4-%EB%A1%9C%EB%94%A9%EA%B3%BC-%EC%86%8D%EB%8F%84-%EA%B7%B8%EB%A6%AC%EA%B3%A0-%EA%B8%B0%EB%B2%95%EB%93%A4)
11. [JVM(Java Virtual Machine) - 짠도리](https://m.blog.naver.com/PostView.nhn?blogId=tmakdlfwotjd&logNo=221300385855&categoryNo=55&proxyReferer=https:%2F%2Fwww.google.com%2F)
12. [클래스로더 1, 동적인 클래스 로딩과 클래스로더 - 자바캔(Java Can Do IT)](https://javacan.tistory.com/entry/1)
13. [클래스로더 2, 자바2의 기본 클래스로더 - 자바캔(Java Can Do IT)](https://javacan.tistory.com/entry/2)
14. [How to Use Java Class Loaders - Jrebel Blog](https://www.jrebel.com/blog/how-to-use-java-class-loaders)
15. [What Is Java Agent? - developer.com](https://www.developer.com/java/data/what-is-java-agent.html)
16. [Understanding Java Agents - Dzone](https://dzone.com/articles/java-agent-1)
17. [Reload java classes without restarting the container - xspdf.com](https://www.xspdf.com/resolution/53249066.html)