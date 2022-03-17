---
title: "To The Moon - 더 나은 로깅시스템을 위한 여정 (Redis 편)"
date: 2020-12-29 19:30:00 +0900
tags:
  - Redis
  - Groovy
  - Lettuce
emoji: 💻
author: 개발한입
categories: 개발 인프라
---

```toc
```

# 목차
- 개요
- STEP 1. Redis Write Back을 도입하는 여정기
- STEP 2. Redis Collection 설계 및 구현
    - STEP 2.1 추가 요구사항
- STEP 3. 문제점
- STEP 4. REFERENCE

# 개요

현재 재직 중인 회사에서 추천 시스템을 도입하기 위해서 기존의 로깅 방식에 대해서 고도화가 필요했었다.

일단, 아주 단순하게 기존 사용자에게 추천됐던 아이템과 읽은 아이템을 토대로 추천 시스템을 만들고자하였다.

이 업무를 진행하기에 앞서 진행되어야하는 부분이 바로 어떤 아이템들이 추천되었고, 어떤 아이템을 읽었는지에 대한 로그를 수집하는 일이었다. 

기존에는 사용자가 클릭을 수행하면 바로 DB에 저장이 되는 형식이였으나 사용자가 증가함에 따라 DB 부하 문제도 있고, 개선책을 찾게 되었다. 

## STEP 1. Redis Write Back을 도입하는 여정기

그에 대한 개선책으로는 이러한 흐름으로 생각하게 되었다. 

- 사용자가 클릭하면 이 데이터를 바로 DB로 넣는 부분은 DB 부하의 문제가 존재한다.

> 그렇다면 어딘가에 클릭했던 내역을 모아두고 일정 시간이 되면 DB에 벌크 삽입(Bulk Insert)하는 방식은 어떨까?

- 그렇다면 이 내역을 일정 기간 동안 모아둘 곳이 필요한데 어디다 모아둘 것인가?

> Redis를 사용하자

위의 내용을 취합하면 우리가 내린 결론은 Redis를 **Write Back** 방식으로 사용하는 것이었다.

해당 내용은 [우아한테크세미나 - 우아한 Redis](https://youtu.be/mPB2CZiAkKM?t=530) 을 참고해보자.

그 후에 배치 잡을 통하여 Redis Cache에 저장된 값을 DB에 Bulk Insert하는 방식으로 방향을 잡게 되었다.

## STEP 1. Redis Collection 설계 및 구현

기존 Redis에는 사용자에게 추천될 아이템의 캐시만 있었던 상황인데 이제 추가적으로 Data들이 필요해졌다.

1. 해당 사용자에게 추천된 아이템들 Collection
2. 해당 사용자가 읽은 아이템 Collection 
3. 해당 사용자가 언제, 읽었고 그 아이템이 추천된 아이템인지를 확인하는 Collection 

Redis Collection을 처음 다루다보니 아주 단순하게 `nested json` 형태로 작업을 하고자하였다. 그러나, 초반부터 난관에 봉착했다.

그 이유는 아주 단순하다. Redis는 `nested hash` 를 지원안한다.

예를 들어보자 아래와 같은 데이터 셋을 나는 가지고 있다.

```
Prod_Color  |   Prod_Count  |   Prod_Price   |   Prod_Info
------------------------------------------------------------
  Red        |       12      |       300      |   In Stock
  Blue       |        8      |       310      |   In Stock
```

그래서 이걸 토대로 아래와 같은 명령어를 통해서 `Hashes` 로 저장하고자 하였다.

```bash
HMSET Records Prod_Color "Red" Prod_Count 12 Prod_Price 300 Prod_Info "In Stock"
HMSET Records Prod_Color "Blue" Prod_Count 8 Prod_Price 310 Prod_Info "In Stock"
```

대충 이 명령어를 수행하면 나올 데이터 셋은 아래와 같을 것이다.

```
{
  Records : [
		{
			Prod_Color : "Red",
			Prod_Count : 12,
			Prod_Price : 300,
			Prod_Info : "In Stock"
		},
		{
			Prod_Color : "Blue",
			Prod_Count : 8,
			Prod_Price : 310,
			Prod_Info : "In Stock",
		}
	]
}
```

그러나, 이런 결과는 Redis에서 허용되지 않는다. 

실제로 위의 명령어를 날린 후 `HGTALL Records` 명령어를 날려보면 이해가 될 것이다.

그렇다면 위와 같은 데이터 구조를 Redis에서는 못 만드는 것일까? 

방법은 존재한다. 

바로 **접미사(Suffix)** 를 활용하는 방식이다.

```bash
/*
 Records:Prod_Color 형태로 Hash를 생성한다. 
 여기서는 Records:red / Records:blue 형태로 생성
*/
HMSET Records:red Prod_Color "Red" Prod_Count 12 Prod_Price 300 Prod_Info "In Stock"
HMSET Records:blue Prod_Color "Blue" Prod_Count 8 Prod_Price 310 Prod_Info "In Stock"

/* 생성된 Hash를 Set의 멤버로 삽입한다 Set의 키는 Records:Ids */
SADD Records:Ids red
SADD Records:Ids blue

/* 
 이를 통하여 Records:Ids로 조회하면 어떤 값들이 들어가있는지 확인 할 수 있다. 
 이렇게 Set을 만듦으로써 전체 Product에 대한 내용은 Set에서 참조 가능하다.
*/
SMEMBERS Records:Ids

/* Hash는 단순히 Records:Ids에서 갖고 있는 Item들을 통해 상세한 값을 조회한다. */
HGETALL Records:ID_OF_MEMBER

/* 아래의 커맨드로 조회가 가능 */
HGETALL Records:red
HGETALL Records:blue
```

자세한 내용은 [writing a query to add multiple values to a key in redis hashes](https://stackoverflow.com/questions/6864968/writing-a-query-to-add-multiple-values-to-a-key-in-redis-hashes) 을 참고하면된다. 

여기서 아이디어를 착안하여 아래와 같이 Collection 설계를 진행하였다.

기존 추천 아이템 설계 Collection은 `recommend:UserIdKey` 를 통하여 각 개인에게 추천된 데이터 리스트들을 담아두었는데 이를 좀 더 확장하였다. 

1. `recommend:UserIdKey`

![redis-collection-ex-1](https://user-images.githubusercontent.com/22961251/111896160-6b0ba580-8a0f-11eb-8f86-4d56fbfbfb04.png)

기존에 사용자 추천 아이템들의 목록을 들고 있는 List

2. `userIdKey:readItemId`

![redis-collection-ex-2](https://user-images.githubusercontent.com/22961251/111896161-6c3cd280-8a0f-11eb-8893-207c5fb4bd0b.png)

각 사용자가 어떤 아이템을 읽었는지에 대한 SET 각 아이템에 대해서 언제 읽었고, 추천되었는지 여부는 위의 아이디어를 차용하여 `HashMap`으로 처리하였다.

3. `userIdKey:readItemId` 

![redis-collection-ex-3](https://user-images.githubusercontent.com/22961251/111896162-6c3cd280-8a0f-11eb-8b7a-c72fb594ac20.png)

즉, abcd라는 사용자가 읽은 데이터의 경우에는 `abcd:readItemId` SET 콜렉션에 저장이 되고, 위의 유저가 itemId가 1인 아이템이 읽었을 경우에는 `abcd:1` HASH에 저장되게끔 설계를 진행하였다. 

이로써, `userId:readItemId` 콜렉션은 각각의 유저들이 어떠한 아이템을 읽었는가에 대한 전체 아이템 id를 갖고 있는 Set이 되며, `userId:readItemId` 구조의 Hash는 언제 읽었고, 이 아이템이 추천된 아이템인지를 `recommend:userId` 구조의 List에서 조회를 통하여 파악하여 생성하는 식으로 설계하였다. 

즉, 이런 식으로 Redis에서 들고 있다가 Batch를 통해서 일정 사이즈 만큼 chunk를 하여 Bulk Insert하는 방식으로 생각하게 되었다. 

![bulk-insert-code](https://user-images.githubusercontent.com/22961251/111896163-6cd56900-8a0f-11eb-8d44-d25f572b21ea.png)

이후 Batch 처리를 하면서 TTL expire를 설정하여 배치를 돌고나면 캐시를 지우는 식으로 진행하였다. 

이렇게 끝날 줄 알았으나 문제점이 발생하였다.

### STEP 2.1 추가 요구사항

- UserRecommendItem 스키마 예시

![db-schema-ex-1](https://user-images.githubusercontent.com/22961251/111896164-6d6dff80-8a0f-11eb-83a8-598968baec49.png)

- UserReadRecommendItem 스키마 예시

![db-schema-ex-2](https://user-images.githubusercontent.com/22961251/111896165-6e069600-8a0f-11eb-932d-ee4b50b19def.png)

문제는 `UserRecommendItem` 스키마에 존재했다. 여기에 `isRead` 속성이 추가되면서 `UserReadRecommendItem` 이 삽입된 후에 얘가 실제로 읽었으면 `true` 로 업데이트해야되는 상황이 된 것이다. 

기존에는 사용자가 읽은 부분에서 이 데이터가 읽었는지 안읽었는지 판별을 수행하였는데 

사용자에게 추천된 아이템에도 이 아이템이 읽었는지 안읽었는지에 대한 판별이 필요하다는 요구사항이 추가된 것이다. 

이렇게 되면 아주 큰 문제가 생기는데 바로 **성능문제**이다.

사실 성능을 생각 안하고 쿼리를 던지면 간단하게 해결할 수 있는 문제일 것이다. 

`UserReadRecommendItem` 에 삽입이 끝나면 다시 `UserRecommendItem` 의 값에서 존재하는 부분을 찾아서 `isRead` 를 업데이트하면 된다.

그러나, 이 부분은 당연히 **성능 상 문제**가 존재한다.

> Select UserReadRecommendItem → Select UserRecommendItem → Update UserRecommendItem isRead = true

이런식으로 **2번의 조회 쿼리와 1번의 update 쿼리**가 날라가는데 이는 대량의 데이터에서는 성능을 기대하기 어려울 수밖에 없다고 생각하였다. 

곰곰히 생각해보니 우리는 이미 Redis를 쓰고 있지 않은가? 

아 차라리 `Bulk Insert` 하기 전에 `Full-Scan` 한 데이터 캐시를 들고 있다가 Redis 상에서 처리를 해서 DB에 쑤시는 방법을 생각하게 되었다. 

아주 간단하게 `userId:readItemId` 와 `userId:recommendItemId` 를 추가하였다. 

![redis-collection-ex-4](https://user-images.githubusercontent.com/22961251/111896166-6e069600-8a0f-11eb-820f-fb859932b246.png)

1. `userId:readItemId` 콜렉션은 `userIdKey:readItemId` 구조의 Set을 전체를 담아두고 있는다. 
2.  `userId:recommendItemId` 콜렉션은 `recommend:userIdKey` 구조의 List 전체를 담아두고 있는다.  

우리는 이렇게 함으로써 사용자에게 추천된 아이템에 대한 정보 전체와 사용자가 읽은 아이템에 대한 정보 전체를 Redis에 캐싱을 할 수 있게 된다.

기존에 업데이트하려고 했을 때 문제는 추천된 아이템에도 읽음 여부가 표시되어야하고 읽은 아이템에도 추천된 아이템인지 여부가 표시되어야한다. 

즉 추천되기도했고 사용자가 읽기도했던 아이템은 아래와 같은 교집합일 것이다.

<p align="center">
    <img src="https://user-images.githubusercontent.com/22961251/111896367-f33e7a80-8a10-11eb-8e65-700716f0cb6c.png">
</p>

하지만 이 부분을 직접 꺼내와서 **서비스 레이어에서 비교를 하자니 속도가 처참**했다. 

그래서 Redis Command 부분을 찾는 중에 `SINTER` 라는 커맨드를 알게되었다. 

![redis-command-sinter](https://user-images.githubusercontent.com/22961251/111896168-6e9f2c80-8a0f-11eb-930a-0d0b1a838c61.png)

우리가 원하는 교집합을 구하는 커맨드였다. 시간복잡도는 O(N*M)으로 빠르다고는 할 수 없겠지만 서비스레이어에서 직접 가져와서 비교하는 것보다 훨씬 빨랐다. 

아직까지 레디스의 메모리가 터지던가 그런 문제는 발생하지 않았으므로 해당 연산을 사용하기로 하였다. 

이렇게 함으로써 DB에 교집합에 속해있는 데이터만 추천된 아이템에 `isRead` 를 `true` 로 바꿔주면되니 전체를 탐색해서 업데이트해야되는 것이 아니라 보다 빠르게 업데이트가 가능해졌다. 

## STEP 3. 문제점

위의 로깅 시스템을 도입 후 잘 사용하고 있다고 생각하였다.

그러나, 바로 문제점이 생겼다. 우리 예상과 다르게 로그의 양이 너무 빠르게 증가되는 문제였다.

희한하게 Redis는 아주 단순하게 `standalone` 띄워놓고 사용하고 있었는데 죽지도 않고 잘 버텨주었고 샤딩이나 레플리케이션 관련하여 점진적으로 개선하자는 부분은 다들 알고 있던 부분이었으나 정작 문제가 생긴건 DB서버였다. 

빠르게 증가하는 로그 덕분에 DB 서버의 `Disk Full` 이 발생할 수 있는 사태까지 진행이되었다. 내부적으로 많은 이야기가 오갔고 결국 선택을 한 것이 **Kakfa를 도입한 후 로그성 데이터들을 S3로 저장**을 하자고 얘기가 나왔다.

다음 편은 Kafka를 로컬에서 어떤식으로 삽질을 진행했고, 운영 서버의 Docker Swarm 레이어에 설계했던 Kafka를 탑재하는데까지의 삽질기에 대해서 작성해보고자 한다.

Redis를 도입하면서 참고했던 자료는 Reference에 달아두었다. 
특히, `SMEMBERS`나 `LRANGE`, `HGETALL` 커맨드들은 `Keys` 커맨드만큼 사용하는데 주의해야하는 커맨드인데 밑에 레퍼런스들 중에서 Best Pratice 관련된 레퍼런스를 보던가 혹은 왜 쓰면 안되는지에 대해서는 Worst Practice를 참고해보자.


# STEP 4. REFERENCE 
1. [Redis의 SCAN은 어떻게 동작하는가? - Kakao Tech](https://tech.kakao.com/2016/03/11/redis-scan/)
2. [Redis Scan/SScan/ZScan/HScan 이야기 - Charsyam's Blog](https://charsyam.wordpress.com/2014/02/04/redis-scansscanzscanhscan-%EC%9D%B4%EC%95%BC%EA%B8%B0/)
6. [Redis best practice - Jin's rambling](https://jinhunpark.com/posts/2019/04/redis-best-practice/)
7. [7 redis Worst Practices - redislabs](https://redislabs.com/blog/7-redis-worst-practices/)
8. [10 quick tips about redis](https://www.objectrocket.com/blog/how-to/10-quick-tips-about-redis/)