---
title: "Spring 공식 예제로 알아보는 SOAP와 WSDL"
date: 2022-02-17 23:39:00 +0900
tags:
  - SOAP
  - WSDL
  - Spring
emoji: 💻
author: 개발한입
categories: 개발
---

```toc
```

# 개요
현재, 간단하게 여행 도메인 관련한 토이 프로젝트를 진행하고 있는 상황이다.
먼저 항공쪽 서비스를 먼저 만들고 있었는데 궁금했던 점은 스카이 스캐너와 같은 서비스에서 어떻게 수 많은 항공사의 정보를 가져오는지 궁금했고, 이 도메인에 대해서 알게된 점과 요청, 응답 스펙에 대해서 알아보고자 한다.

## GDS(Global Distribution Systems)
수 많은 온라인 여행사(OTA)들이 전 세계의 항공 정보를 가져오고 있다.
위에 개요에 말한 것 처럼 나는 이게 어떻게 가져오는 지 궁금해졌고, 리서치를 하기 시작했다. 

리서치를 하다보니 생소한 용어인 GDS(Global Distribution Systems)라는 를 알게되었는데 GDS는 대형항공사의 자체 예약 시스템인 CRS(Central Reservation System)이 진화한 형태로 CRS는 항공사마다 요청 스펙이 다를 수 있다보니 다중 항공사와의 시스템 호환이나 예약에는 한계가 있어서 GDS가 만들어지게 되었다고 한다.

아마도, 많은 여행사들이 이 GDS를 통해서 항공 정보를 가져오는 것으로 보인다. 

GDS는 전세계에서 크게 3개의 기업으로 나눠지는데 다음과 같다.

1. [토파스(아마데우스)](https://developers.amadeus.com/)
2. [애바카스(아시나아세이버)](https://www.asianasabre.co.kr/)
3. [갈릴레오, 월드스팬(트래블포트)](http://galileo.co.kr/)

이중에서 토파스는 대한항공이 사용하고, 애바카스는 아시나아에서 사용한다.
리서치를 하다보니 GDS와 항공사와 합작회사를 만들어서 사용하는게 대다수인 거 같다.

아무튼 국내 항공 여행 서비스를 제공해주는 회사들을 위와 같은 솔루션을 활용한다고 생각하면 될 것 같다.

당연히 GDS 마다 차이가 있고, 광고 도메인의 DSP(Demand-Side Platform) 마냥 이 GDS를 가공해서 B2C를 하는 업체에게 제공해주는 곳도 있을 것이다. 

찾아보니 [Bdtask](https://www.bdtask.com/flight-booking-software.php) 이런 곳이 그러한 역할을 해줄 것 같다. 아무튼 GDS마다 제공해주는 API 방식도 가지각색인데 그 중에서 **SOAP(Simple Object Access Protocol)** 은 공통적으로 제공한다.

본 포스팅은 **SOAP** 로 데이터를 통신하는 예제를 다뤄보고자한다.

그 전에 먼저 알아둬야할 선행 지식들이 몇가지 존재한다.

## SOAP와 WSDL
### SOAP(Simple Object Access Protocol)란?
SOAP는 HTTP, HTTPS, SMTP 등을 통해서 **XML 기반** 의 메시지를 컴퓨터 네트워크 상에서 교환하는 프로토콜이다. 뜻과 같이 간단하게 객체로 접근가능한 프로토콜이라는 의미이다.

JSON과 같이 XML도 플랫폼과 프로그래밍 언어에 종속적이지 않기 때문에 **이기종간의 통신이 가능**하다는 장점이 존재한다. 

SOAP의 메시지 형태는 다음과 같다.

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/154504754-413e3c8b-f689-4d6b-a730-63b6f255655a.png">
</p>
<p align="center">
    <em><a href="https://narup.tistory.com/80">시간이 멈추는 장소, Simple Object Access Protocol이란?, 2020</a></em>
</p>

그리고, SOAP는 WSDL(Web Service Description Language)를 통해서 이 서비스가 현재 어떤 내용들을 제공해주는지 알려준다.

REST의 예로 들면 `api/v1/github/docs` 라는 api가 해당 api에 대한 명세에 대한 목록들을 담고 있다 가정하면, SOAP에서는 WSDL이 그러한 역할을 해준다고 볼 수 있다.

### WSDL(Web Services Description Language) 란?

예시로 현재 만들고 있는 토이 프로젝트에서 제공하는 WSDL을 샘플로 확인해보자.

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<wsdl:definitions
	xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
	xmlns:sch0="http://dailyworker.github.io/tiny-travel/flight/schemas/messages"
	xmlns:sch1="http://dailyworker.github.io/tiny-travel/flight/schemas/types"
	xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
	xmlns:tns="http://dailyworker.github.io/tiny-travel/flight/schemas/definitions" targetNamespace="http://dailyworker.github.io/tiny-travel/flight/schemas/definitions">
	<wsdl:types>
		<schema
			xmlns="http://www.w3.org/2001/XMLSchema"
			xmlns:tns="http://dailyworker.github.io/tiny-travel/flight/schemas/messages"
			xmlns:types="http://dailyworker.github.io/tiny-travel/flight/schemas/types" attributeFormDefault="unqualified" elementFormDefault="qualified" targetNamespace="http://dailyworker.github.io/tiny-travel/flight/schemas/messages">
			<import namespace="http://dailyworker.github.io/tiny-travel/flight/schemas/types"/>
			<element name="GetFlightsRequest">
				<complexType>
					<all>
						<element name="from" type="types:Airport"/>
						<element name="to" type="types:Airport"/>
						<element name="departureDate" type="date"/>
					</all>
				</complexType>
			</element>
			<element name="GetFlightsResponse">
				<complexType>
					<sequence>
						<element maxOccurs="unbounded" minOccurs="0" name="flightSchedule" type="types:FlightSchedule"/>
					</sequence>
				</complexType>
			</element>
		</schema>
		<schema
			xmlns="http://www.w3.org/2001/XMLSchema"
			xmlns:tns="http://dailyworker.github.io/tiny-travel/flight/schemas/types" attributeFormDefault="unqualified" elementFormDefault="qualified" targetNamespace="http://dailyworker.github.io/tiny-travel/flight/schemas/types">
			<complexType name="FlightSchedule">
				<sequence>
					<element name="AirPlane" type="tns:Airplane"/>
					<element name="departDate" type="dateTime"/>
					<element name="from" type="tns:Airport"/>
					<element name="arriveDate" type="dateTime"/>
					<element name="to" type="tns:Airport"/>
				</sequence>
			</complexType>
			<complexType name="Airplane">
				<sequence>
					<element name="flightModelName" type="string"/>
					<element name="flightNumber" type="string"/>
					<element name="available" type="int"/>
				</sequence>
			</complexType>
			<complexType name="Airport">
				<all>
					<element name="city" type="string"/>
					<element name="airport" type="string"/>
				</all>
			</complexType>
		</schema>
	</wsdl:types>
	<wsdl:message name="GetFlightsRequest">
		<wsdl:part element="sch0:GetFlightsRequest" name="GetFlightsRequest"></wsdl:part>
	</wsdl:message>
	<wsdl:message name="GetFlightsResponse">
		<wsdl:part element="sch0:GetFlightsResponse" name="GetFlightsResponse"></wsdl:part>
	</wsdl:message>
	<wsdl:portType name="FlightPort">
		<wsdl:operation name="GetFlights">
			<wsdl:input message="tns:GetFlightsRequest" name="GetFlightsRequest"></wsdl:input>
			<wsdl:output message="tns:GetFlightsResponse" name="GetFlightsResponse"></wsdl:output>
		</wsdl:operation>
	</wsdl:portType>
	<wsdl:binding name="FlightPortSoap11" type="tns:FlightPort">
		<soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
		<wsdl:operation name="GetFlights">
			<soap:operation soapAction=""/>
			<wsdl:input name="GetFlightsRequest">
				<soap:body use="literal"/>
			</wsdl:input>
			<wsdl:output name="GetFlightsResponse">
				<soap:body use="literal"/>
			</wsdl:output>
		</wsdl:operation>
	</wsdl:binding>
	<wsdl:service name="FlightPortService">
		<wsdl:port binding="tns:FlightPortSoap11" name="FlightPortSoap11">
			<soap:address location="http://localhost:8081/flight-service"/>
		</wsdl:port>
	</wsdl:service>
</wsdl:definitions>
```

역시 `XML` 기반이다보니 복잡해보인다.
하지만 하나씩 까보면 그렇게 어렵지(??)는 않은데 중요하게 볼 부분은 다음과 같다.

1. `<wsdl:types> ... </wsdl:types>` : **교환될 메시지의 설명 및 해당 메시지에 사용될 타입을 정의**한다. 여기서 타입은 스키마의 정의에 따르는데 우리는 `xmlns:tns="http://dailyworker.github.io/tiny-travel/flight/schemas/types" ` 여기에 명시된 타입들로 처리된다고 생각하면 된다.  실제로, `<element name="from" type="tns:Airport"/>` 와 같이 `tns` 가 붙은 것들은 해당 스키마에서 정해둔 타입을 활용한다.
2. `<wsdl:message> ... </wsdl:message>` : **어떠한 메시지가 교환되는지에 대한 내용이 담겨져있다.** `<wsdl:message name="GetFlightsRequest">`  이 부분을 위의 코드에서 검색해보자. 이는 DTO마냥 `GetFlightsRequest` 형식이 들어올 경우에 아래의 블록이 수행된다는 내용이다.
3. `<wsdl:part> ... </wsdl:part>` : 위의 내용의 아래 블록을 보면 명시된 내용인데 이는 내부에서 타입을 선언하자면 `XML` 크기가 너무 커지니 `GetFlightsRequest` 의 **타입에 대한 바인딩 정보가 담겨져 있다고 생각**하면된다. (원래라면 내부에 또 타입을 정의할 수도 있는데 이렇게 함으로써 XML의 중복을 제거한다고 생각하면 된다.)
4. `<wsdl:portType> ... <wsdl:portType>` : RESTful API의 예시로 들면 **어떠한 요청이 들어왔을 때, 응답이 어떠한 값으로 나오는지에 대한 정의**가 명세되어있다고 생각하면 될 것 같다. 
5. `<wsdl:binding> ... <wsdl:binding>`  : 특정 `portType` 에 대한 **메시지 포맷이나 프로토콜, operation 에 대한 정의**부분이라고 생각하면 된다.

대략적인 내용은 이러하다. 

좀 더 자세한 내용을 알고 싶다면 [Web Service Definition Language (WSDL) 1.1](https://www.w3.org/TR/wsdl.html) 이 문서를 추천한다. 상세 스펙문서이다. 

뭐 이 내용들은 밑에 실습을 진행하면서 다시한번 이야기해보도록 하겠다.
자세한 이해보다는 대략적으로 아 대충 이런거구나라고 느끼는게 더 중요할 것 같다.

정리하자면 SOAP는 XML 기반의 메시지 통신, 교환 프로토콜이고, 이 SOAP를 사용하기 위해서 어떤 메시지를 어떤 타입으로 주고받아야하는가에 대한 명세서가 WSDL이라고 이해하면 될 것 같다.

잠깐 RESTful API와 비교를 해보자.

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/154505519-9f960d12-db3b-48c7-b325-fa33b43d9d7e.jpeg">
</p>
<p align="center">
    <em><a href="https://stackoverflow.com/a/8983122">Nakkeeran, Simple explanation about SOAP and REST (stackoverflow)</a></em>
</p>

이 짤방이 너무나 잘 요약해주고 있는 것 같다. SOAP는 위의 규약과 WSDL등의 규칙이 존재하기때문에 데이터 요청을 주고받을 때도 **SOAP Standards** 를 지켜서 보내야한다.

여기서 말하는 **SOAP Standard** 는 **SOAP Envelope, SOAP Head, SOAP Body**와 같은 것들을 말한다.

+ SOAP 데이터 요청 예시
<p align="center">
  <img src="https://user-images.githubusercontent.com/22961251/154505598-c71a92c2-fcce-4577-8d86-2e3713e1f5c3.png">
</p>

이 예시를 보면 **SOAP Envelope, SOAP Head, SOAP Body**가 포함되어있고, **Body** 내부에 실제 요청을 보낼 데이터가 담겨져있는 것을 확인 할 수 있다.

SOAP 방식의 추가적인 단점은 단순 요청도 데이터 타입과 규약들이 필요하다보니 **POST**로 보내야한다. 

원래 RESTful이라면 `GET : api/v1/schedule/AMS-VCE-2006-01-13` 이런식으로도 단순화를 시킬 수 있었을 것이다. 

혹은 위와 같이 `POST` 요청이라면 RESTful하진 않지만 HTTP API로 가정해서 설계해본다면 아래와 같이도 가능할 것이다.

```
POST : api/v1/schedule 
BODY : {
	"from" : "AMS",
	"to"   : "VCE",
	"departureDate" : "2006-01-31"
}
```

당연히 SOAP를 사용하는 것보다 편하다.

하지만, 이를 사용하는 이유는 `RESTful API` 이전에 수 많은 **Enterprise Service**들은 SOAP 기반으로 통신을 하였고,  이 잔재가 아직 남아있는 것이라고도 볼 수 있을 것이다. 

그때 당시에 분명 언어나 플랫폼의 종속성 없이 XML을 정해진 규약대로 보내면 해당 요청과 응답을 받는다는 것은 각 서비스마다의 **Integration** 또한, 편했을 것이다라고 생각한다.

RESTful과 SOAP 비교 관련해서는  [Roots of the REST/SOAP Debate](http://web.archive.org/web/20120421084456/http://www.prescod.net/rest/rest_vs_soap_overview/) 이 문서를 참고하고, 현재까지 SOAP를 쓰는 이유에 대해서는 [Why are most of the flight booking providers still using WSDL and SOAP? Why would anyone use them? - Quora](https://qr.ae/pGj0ur) 이 답변이 도움이 되보인다.

결론은 아직까지도 쓰니까 우리는 쓰는 방법을 알아야한다고 요약할 수 있을 것 같다.
다음은 스프링에서 이를 다루는 방법을 얘기해보고자 한다.

## Spring Boot SOAP 예시
여기서는 이미 만들어진 코드를 갖고 단순하게 얘기해보고자 한다.
해당 코드는 [Producing a SOAP web Service](https://spring.io/guides/gs/producing-web-service/)와 동일하다.
전체 코드는 [spring-producing-ws-example](https://github.com/dailyworker/blog-example/tree/study/ws/spring-producing-ws-example) 을 참고하자.

### XML 스키마 파일 작성
예시 프로젝트에서 사용할 XML 스키마 파일은 `countries.xsd` 이다.

```xml
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:tns="http://spring.io/guides/gs-producing-web-service"
           targetNamespace="http://spring.io/guides/gs-producing-web-service" elementFormDefault="qualified">

    <xs:element name="getCountryRequest">
        <xs:complexType>
            <xs:sequence>
                <xs:element name="name" type="xs:string"/>
            </xs:sequence>
        </xs:complexType>
    </xs:element>

    <xs:element name="getCountryResponse">
        <xs:complexType>
            <xs:sequence>
                <xs:element name="country" type="tns:country"/>
            </xs:sequence>
        </xs:complexType>
    </xs:element>

    <xs:complexType name="country">
        <xs:sequence>
            <xs:element name="name" type="xs:string"/>
            <xs:element name="population" type="xs:int"/>
            <xs:element name="capital" type="xs:string"/>
            <xs:element name="currency" type="tns:currency"/>
        </xs:sequence>
    </xs:complexType>

    <xs:simpleType name="currency">
        <xs:restriction base="xs:string">
            <xs:enumeration value="GBP"/>
            <xs:enumeration value="EUR"/>
            <xs:enumeration value="PLN"/>
        </xs:restriction>
    </xs:simpleType>
</xs:schema>
```

구조를 보면 대충 눈치를 채겠지만, `getCountryRequest` 를 받아서 `getContryResponse` 로 던져주는 SOAP WebService를 만들 것이다.

예시 프로젝트에서 사용될 타입은 `currency` 와 `country` 타입이다.

자 이제 이 XML 스키마 파일을 자바 클래스 파일로 역직렬화하여야 한다.

### XML 파일을 자바 클래스 파일로 만들기

이제 XML을 자바 클래스 파일로 만들어야하는데 일일히 만들어주는 것은 번거로우니 `JAXB` 를 이용하여 해당 `.xsd` 파일에 대해서 자동으로 자바 클래스 파일로 만들어줘야하는 작업이 필요하다.

이를 위해서 `build.gradle` 파일에 태스크와 의존성을 추가한다.

+ build.gradle 

```groovy
...
configurations {
    jaxb
}

sourceSets {
    main {
        java {
            srcDir 'src/main/java'
            srcDir 'build/generated-sources/jaxb' // xsd 파일을 통해서 역직렬화되어 생성되는 자바 클래스파일의 위치
        }
    }
}
// xsd 파일을 토대로 자바 클래스 파일을 생성한다
task genJaxb {
    ext.sourcesDir = "${buildDir}/generated-sources/jaxb"
    ext.schema = "src/main/resources/countries.xsd"

    outputs.dir sourcesDir

    doLast() {
        // 커스텀 Ant 태스크를 만든다.
        project.ant {
            taskdef name: "xjc", classname: "com.sun.tools.xjc.XJCTask",
                    classpath: configurations.jaxb.asPath
            mkdir(dir: sourcesDir)
            // 위에서 입력한 스키마 폴더와 소스디렉토리에 .xsd 파일을 토대로 XML을 자바 객체로 역직렬화(Unmarshalling) 한다.
            xjc(destdir: sourcesDir, schema: schema) {
                arg(value: "-wsdl")
                produces(dir: sourcesDir, includes: "**/*.java")
            }
        }
    }
}
...

dependencies {
...
       implementation 'org.glassfish.jaxb:jaxb-runtime:2.3.2' // JDK 11 호환 문제때문에 의존성 추가
    implementation 'wsdl4j:wsdl4j'
    jaxb("org.glassfish.jaxb:jaxb-xjc")

    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}
```

이후에 `gradle genJaxb` 명령어를 수행하면 아래와 같이 클래스 파일이 만들어짐을 확인할 수 있다. 

<p align="center">
  <img src="https://user-images.githubusercontent.com/22961251/154505901-e5fdc7dc-d1e5-421b-ae3d-d39614e34638.png">
</p>

 `QueryDSL` 의 `Q` 파일처럼 실제 사용하기 위해서는 이런 언마샬링 과정이 필요하다고 생각하면 될 것 같다.

주의 할 점은 `QueryDSL` 은 도메인 파일에 `Q` 를 붙여줘서 혼동할 일이 적지만, `JAXB` 로 생성되는 스키마 객체는 도메인 클래스 파일과 이름이 동일할 수 있으므로, 헷갈릴 수가 있다.

실제 프로젝트를 보면 `Country` 나 `Currency` 클래스 파일이 존재하지않는데 위에서 언마샬링해서 생성된 파일을 사용하기 때문이다. 

그렇다면, 실제 도메인 객체와 언마샬링 객체와 컨버팅할 수 있는 방법은 없을까?
이는 나중에 보도록하자.

대충 언마샬링까지 되는 것 같으니 이제 `Endpoint` 파일과 `Config` 파일을 만든다.

### Endpoint 클래스 및 Config 클래스

언마샬링 객체를 initialize하는 `Repository` 클래스는 [ContryRepository](https://github.com/dailyworker/blog-example/blob/study/ws/spring-producing-ws-example/src/main/java/io/github/dailyworker/springproducingwsexample/CountryRepository.java)
파일을 참고하자.

+ WebServiceConfig

```java
@EnableWs
@Configuration
public class WebServiceConfig extends WsConfigurerAdapter {
    @Bean
    public ServletRegistrationBean<MessageDispatcherServlet> messageDispatcherServlet(ApplicationContext applicationContext) {
        MessageDispatcherServlet servlet = new MessageDispatcherServlet();
        servlet.setApplicationContext(applicationContext);
        servlet.setTransformWsdlLocations(true);
        return new ServletRegistrationBean<>(servlet, "/ws/*");
    }

    @Bean(name = "countries") // http://localhost8080/ws/countries.wsdl
    public DefaultWsdl11Definition defaultWsdl11Definition(XsdSchema countriesSchema) {
        DefaultWsdl11Definition wsdl11Definition = new DefaultWsdl11Definition();
        wsdl11Definition.setPortTypeName("CountriesPort");
        wsdl11Definition.setLocationUri("/ws"); // wsdl url 설정
        wsdl11Definition.setTargetNamespace("http://spring.io/guides/gs-producing-web-service"); // 타겟 네임스페이스 설정
        wsdl11Definition.setSchema(countriesSchema); // 스키마 설정
        return wsdl11Definition;
    }

    @Bean
    public XsdSchema countriesSchema() {
        return new SimpleXsdSchema(new ClassPathResource("countries.xsd")); // 사용할 스키마 파일 위치 등록
    }
}
```

위 코드에서 중요한 부분만 살펴보자.

+  `countriesSchema()`

먼저 `countriesSchema()` 는 `resource/countries.xsd` 파일을 통해서 이 파일을 스키마로 사용하겠다고 선언하는 부분이다.

+ `defaultWsdl11Definition(XsdSchema countiresSchema)`

`defaultWsdl11Definition(XsdSchema countiresSchema)` 은 입력된 스키마를 토대로 `<wsdl:definition> ... </wsdl:definition>` 을 만들어주는 녀석이다.  내부 로직을 보면 알겠지만, uri나 portType등을 설정한다.

참고로 `@Bean(name = "countries)"` 를 통해서 `.wsdl` 호출 url이 설정 가능하다. 물론 메서드명으로도 가능하다. `defaultWsdl11Definition()` 메서드를 `countries()` 로 바꾸고 위의 어노테이션을 지워도 `http://localhost:8080/ws/countries.wsdl` 로 접근하여 서비스 목록을 확인할 수 있다.

다음은 SOAP의 컨트롤러의 역할을 한다고 볼 수 있는 Endpoint 이다.

+ CountryEndpoint
```java
@Endpoint
public class CountryEndpoint {
    private static final String NAMESPACE_URI = "http://spring.io/guides/gs-producing-web-service";
    private final CountryRepository countryRepository;

    public CountryEndpoint(CountryRepository countryRepository) {
        this.countryRepository = countryRepository;
    }

    @PayloadRoot(namespace = NAMESPACE_URI, localPart = "getCountryRequest")
    @ResponsePayload
    public GetCountryResponse getCountry(@RequestPayload GetCountryRequest request) {
        GetCountryResponse response = new GetCountryResponse();
        response.setCountry(countryRepository.findCountry(request.getName()));
        return response;
    }
}
```

여기서는 `getCountry()` 메서드 부분만 보고자한다.

+ `@PayloadRoot(namespace = NAMESPACE_URI, localPart = "getCountryRequest")`

먼저 `@PayloadRoot` 는 @MVC의 `@RequestMapping` 과 비슷한 역할을 한다. 다른 부분은 `@PayloadRoot` 의 `namespace` 와 `localPart` 가 일치해야 하위 메서드로 매핑되어 타진다는 것 뿐이다. 

각각의 파라미터들은 아래와 같은 역할을 한다.

먼저 `namespace` 는 `countries.xsd` 내부에 작성된 `targetNamespace` 를 입력해준다. 이 네임스페이스를 토대로 타입이나 기타 값들을 처리하기 때문이다.

확인해보면 ` private static final String NAMESPACE_URI = "http://spring.io/guides/gs-producing-web-service";` 이 값이 `countries.xsd` 파일의 `targetNamespace` 와 일치함을 알 수 있다.

그 뒤에 `localPart` 는 요청으로 들어온 데이터 객체의 타입을 확인한다.
여기서는 `getCountryRequest` 일 때 하위 메서드가 실행될 것이다. 

+  `@ResponsePayload`
이 어노테이션은 @MVC의 `@ResponseBody` 와 비슷한 역할을 한다 보면된다.

뭐 이 두개만 알고있다면 내부 로직은 대충 요청으로 들어온 값을 찾아서 있으면 `GetCountryResponse` 로 감싸서 던진다는 내용이라 보면 될 것이다.

### 실제 테스트
E2E 테스트를 위해서 build.gradle에 다음 의존성을 추가한다.

`testImplementation 'org.springframework.ws:spring-ws-test'`

전체 코드는 [CountryEndpointTest.java](https://github.com/dailyworker/blog-example/blob/study/ws/spring-producing-ws-example/src/test/java/io/github/dailyworker/springproducingwsexample/CountryEndpointTest.java)을 참고하자.

```java
...
@Test
public void getCountry() throws IOException {
    Source getCountryRequest = new StringSource("<gs:getCountryRequest xmlns:gs='" + NAMESPACE_URI + "'>" + "<gs:name>Spain</gs:name>" + "</gs:getCountryRequest>");

    Source getCountryResponse = new StringSource("<ns2:getCountryResponse xmlns:ns2='" + NAMESPACE_URI + "'>" + "<ns2:country>" + "<ns2:name>Spain</ns2:name>" +
            "<ns2:population>46704314</ns2:population>" + "<ns2:capital>Madrid</ns2:capital>" + "<ns2:currency>EUR</ns2:currency>" + "</ns2:country>" + "</ns2:getCountryResponse>");

    mockClient
            .sendRequest(withPayload(getCountryRequest))
            .andExpect(noFault())
            .andExpect(payload(getCountryResponse))
            .andExpect(validPayload(schema));
}
...
```

해당 네임스페이스를 E2E 테스트로 목클라이언트에게 넘겨서 요청과 응답을 테스트하는 테스트이다. 테스트가 성공적으로 돌아감을 확인하였으니 이제 실제로 요청을 보내보자.

+ WSDL 목록 요청 (http://localhost:8080/ws/countries.wsdl)
<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/154506072-3cafd507-df04-4d89-9d42-8f32c733cfd4.png">
</p>

+ 실제 요청 테스트 및 응답 값 확인 (http://localhost:8080/ws)

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/154506059-29233a65-384d-41e1-8303-858a86fdce05.png">
</p>

주의할 점은 `POST` 로 요청을 보내야한다는 점이다.
이렇게 함으로써 SOAP WebService의 맛을 한번 보게되었다.

# 결론
항공 조회 토이프로젝트를 만들면서 `GDS` 라는 개념을 알게 되었고, `GDS` 가 제공해주는 `SOAP` 라는 것을 알게되서 `WSDL` 과 이걸 스프링으로 간단하게 만들어보는 예시 작업을 하였다.

아까전에 잠깐 설명했지만, `QueryDSL` 과 달리 위 코드는 도메인 코드와 XSD 스키마 코드가 동일한 이름을 갖으므로 혼동될 수 있다.

또한 XSD 스키마와 도메인 클래스간의 변환은 어떻게 할 것인가에 대한 문제가 존재한다.

잠깐 토이 프로젝트의 샘플 코드를 보자.

+ SchemaConversionUtils
```java
public static FlightSchedule toSchemaType(io.dailyworker.flight.domain.FlightSchedule domainFlightSchedule)
        throws DatatypeConfigurationException {

    FlightSchedule schemaFlight = new FlightSchedule();

    schemaFlight.setAirPlane(toSchemaType(domainFlightSchedule.getAirplane()));
    schemaFlight.setFrom(toSchemaType(domainFlightSchedule.getFrom()));
    schemaFlight.setDepartDate(toXMLGregorianCalendar(domainFlightSchedule.getDepartDate()));
    schemaFlight.setTo(toSchemaType(domainFlightSchedule.getTo()));
    schemaFlight.setArriveDate(toXMLGregorianCalendar(domainFlightSchedule.getArriveDate()));
    return schemaFlight;
}
```

위 코드는 인자로 도메인 클래스를 받아서 XSD 스키마 객체로 바꿔주는 작업을 한다.
이런 식으로 구별하기 위해서 풀 패키지명을 작성하는 것도 좋아보인다.

하지만, 위와 같이 작성하면 코드가 지저분해지는 단점이 있다. 
내 생각은 분명 JAXB를 제너레이트할 때 다른 클래스명으로 만드는 방법도 있을 것 같은데 아직 못찾았으니 일단 임시방편으로 활용하고 있다.

더 나아가 분명 도메인, XSD 스키마 클래스간의 매핑도 일일히 위와 같이 하지 않고 오브젝트매퍼와 같은 도구가 있을 것 같은데 찾으면 공유해보도록 하겠다.

참고로 웹서비스 예제는 아주 잘나와있는 예제가 있다.

JPA와 활용해서 언마샬링 객체와 컨버팅 및 핸들링하는 부분의 상당한 부분을 이 프로젝트에서 아이디어를 착안하고 이를 적절하게 바꾸면서 사용하고 있는데 [spring-ws-sample](https://github.com/spring-projects/spring-ws-samples) 이 프로젝트를 추천한다.


# 레퍼런스 
1. [GDS 3파전 본격화...새로운 전쟁의 시작](http://www.gtn.co.kr/mobile/news_view.asp?news_seq=62639)
2. [GDS Integration](https://medium.com/@stevenson14789632/gds-integration-f8717f1e3f65)
3. [SOAP Simple Object Access Protocol이란?](https://narup.tistory.com/80)
4. [Representational state transfer (REST) and Simple Object Access Protocol (SOAP)](https://stackoverflow.com/questions/209905/representational-state-transfer-rest-and-simple-object-access-protocol-soap) 
5. [Roots of the REST/SOAP Debate](http://web.archive.org/web/20120421084456/http://www.prescod.net/rest/rest_vs_soap_overview/)
6.  [Why are most of the flight booking providers still using WSDL and SOAP? Why would anyone use them? - Quora](https://qr.ae/pGj0ur) 
7. [Simple Object Access Protocol (SOAP) 1.1](https://www.w3.org/TR/2000/NOTE-SOAP-20000508/)
