---
emoji: 🧢
title: 리눅스(CentOS7)에서 자바 개발환경 구축하기 - JDK10 설치하기
date: 2018-07-03 10:50:00 +0900
author: 개발한입
tags: 
    - Linux
    - centOS7
    - JDK
    - Java
    - setting_environment
categories: 인프라
---


## 개요
오늘은 Centos7에서 Java 개발환경을 구성하는 첫번째 단추인 Java(JDK)를 설치 후에 환경변수까지 설정하는 것을 적어보려고 한다.
## 운영체제 환경
### 리눅스
    1. 리눅스 배포반 버전
    2. 리눅스 커널 버전

1. 리눅스 배포판 버전
```console
[azureuser@AzureCentOS ~]$ grep . /etc/*-release
/etc/centos-release:CentOS Linux release 7.5.1804 (Core)
/etc/os-release:NAME="CentOS Linux"
/etc/os-release:VERSION="7 (Core)"
/etc/os-release:ID="centos"
/etc/os-release:ID_LIKE="rhel fedora"
/etc/os-release:VERSION_ID="7"
/etc/os-release:PRETTY_NAME="CentOS Linux 7 (Core)"
/etc/os-release:ANSI_COLOR="0;31"
/etc/os-release:CPE_NAME="cpe:/o:centos:centos:7"
/etc/os-release:HOME_URL="https://www.centos.org/"
/etc/os-release:BUG_REPORT_URL="https://bugs.centos.org/"
/etc/os-release:CENTOS_MANTISBT_PROJECT="CentOS-7"
/etc/os-release:CENTOS_MANTISBT_PROJECT_VERSION="7"
/etc/os-release:REDHAT_SUPPORT_PRODUCT="centos"
/etc/os-release:REDHAT_SUPPORT_PRODUCT_VERSION="7"
/etc/redhat-release:CentOS Linux release 7.5.1804 (Core)
/etc/system-release:CentOS Linux release 7.5.1804 (Core)
``` 
1. 리눅스 커널 버전
```console
[azureuser@AzureCentOS ~]$ yum list installed | grep ^kernel
kernel.x86_64                          3.10.0-327.18.2.el7            @updates
kernel.x86_64                          3.10.0-327.28.2.el7            @updates
kernel.x86_64                          3.10.0-862.3.2.el7             @updates
kernel-headers.x86_64                  3.10.0-862.3.2.el7             @updates
kernel-tools.x86_64                    3.10.0-862.3.2.el7             @updates
kernel-tools-libs.x86_64               3.10.0-862.3.2.el7             @updates
```

커널 버전과 배포판 버전은 위의 코드와 같이 CentOS-7.5버전과 3.10.0 커널을 사용한다. 


## JDK 설치하기
초기에는 원래 JDK9을 설치하려 했으나, 나온지 얼마 안되서 Java10 [^1]으로 통합이 되었는지 현재 JDK9는 *End of support* [^2]상태이다.(아무래도 Java10으로 통합이 된 것같다.) 따라서 Java버전은 Java10 [^1]으로 설치를 진행한다.

방법은 소스를 다운로드 받아서 설치하는 방법과
RPM 다운로드를 통하여 yum으로 설치하는 방법이 있다.

여기서는 두 방법 모두 다뤄보기로 한다.
### JDK10 Install Using Downloaded JDK10 Binary file
***
1. STEP 1 - JDK10 소스 다운로드하기
2. STEP 2 - JDK10 명령어 등록
3. STEP 3 - JDK10 설치 확인

### JDK10 Install Using Downloaded JDK10 RPM file
***
1. STEP 1 - JDK10 RPM 다운로드하기
2. STEP 2 - JDK10 설치 하기

***
#### 1.1 STEP 1 - JDK10 소스 다운로드하기

먼저 wget을 이용하기 때문에 wget이 설치되어 있는지부터 확인한다.
(Minimal버전 일 경우에도 wget은 설치되어 있는 것으로 알고 있다.)

```console
[azureuser@AzureCentOS ~]$ yum list installed | grep wget
wget.x86_64                            1.14-15.el7_4.1                @base
```
<span class="evidence">yum list installed</span>
해당 명령어로 설치된 명령어를 확인 할 수가 있는데 
<span class="evidence">| grep wget</span>
파이프 연산 [^3]과 grep을 통해 wget이 설치되었는지 확인 할 수가 있다. 당연하게도 wget자리에 다른 패키지로 입력하면 다른 패키지도 확인 할 수가 있다.

현재 JDK10의 Latest Version은 10.0.1이다.
```console
[azureuser@AzureCentOS local]$ sudo wget --no-cookies --no-check-certificate --header "Cookie: oraclelicense=accept-securebackup-cookie" \
  http://download.oracle.com/otn-pub/java/jdk/10.0.1+10/fb4372174a714e6b8c52526dc134031e/jdk-10.0.1_linux-x64_bin.tar.gz
```
해당 명령어를 주어서 자바10 JDK 소스파일을 다운로드 받는다.
나와 같은 경우에는 해당 소스를 <span class="evidence">/usr/local/src</span>에 넣어놨는데 Java의 위치는 <span class="evidence">/usr/local/java-* </span>으로 하고 싶기때문에 압축풀때 따로 해당 폴더에 풀리도록 옵션을 추가하겠다.
```console
tar zxf jdk-10.0.1_linux-x64_bin.tar.gz -C /usr/local
```
그 후에 jdk-10.0.1을 /usr/local/java로 사용하기 위해서 심볼릭링크 [^4]를 생성한다. 
```console
ln -s /usr/local/jdk-10.0.1 /usr/local/java
```
#### 1.2 STEP 2 - JDK10 명령어 등록

압축풀기와 심볼릭링크 생성까지 마친 다음에는 이제는 명령어 등록하는 절차가 필요하다.

```console
alternatives --install /usr/bin/java java /usr/local/bin/java 1
alternatives --config java

alternatives --install /usr/bin/jar jar /usr/local/java/bin/jar 1
alternatives --install /usr/bin/javac javac /usr/local/java/bin/javac 1

alternatives --set jar /usr/local/java/bin/jar
alternatives --set javac /usr/local/java/bin/javac
```

alternatives명령어를 통해 java와 jar, javac 명령어를 등록한다.

#### 1.3 STEP 3 - JDK10 설치 확인

STEP 1, 2를 끝낸 후라면 정상적인 경우에는 

```console
[azureuser@AzureCentOS local]$ java -version java -version
java 10 2018-04-17
Java(TM) SE Runtime Environment 18.3 (build 10+46)
Java HotSpot(TM) 64-Bit Server VM 18.3 (build 10+46, mixed mode)

[azureuser@AzureCentOS local]$ javac -version
javac 10.0.1
```
이런식으로 등록한 명령어에 대한 결과 값이 정상적으로 출력이 된다.

***
#### 2.1 STEP 1 - JDK10 RPM 다운로드하기
```console
[azureuser@AzureCentOS src]$ sudo wget --no-cookies --no-check-certificate --header "Cookie: oraclelicense=accept-securebackup-cookie" \
> http://download.oracle.com/otn-pub/java/jdk/10.0.1+10/fb4372174a714e6b8c52526dc134031e/jdk-10.0.1_linux-x64_bin.rpm
```
1.1과 마찬가지로 wget을 이용하여, rpm을 다운로드 받는다.

#### 2.2 STEP 2 - JDK10 설치 하기
```console
[azureuser@AzureCentOS src]$ sudo yum localinstall jdk-10.0.1_linux-x64_bin.rpm
```
그 후에 localinstall로 통하여 로컬로 다운로드 받아진 rpm 파일을 yum을 통해서 설치한다.

그 후에 또 1.3과 마찬가지로 버전확인을 한다.

만일, JDK가 여러가지가 설치 된 경우에 새로 받은 JDK를 선택해야되는 상황이라면, 

```console
sudo alternatives --config java
There are 4 programs which provide 'java'.

  Selection    Command
-----------------------------------------------
   1           /usr/java/jdk1.8.0_162/jre/bin/java
   2           java-1.8.0-openjdk.x86_64 (/usr/lib/jvm/java-1.8.0-openjdk-1.8.0.161-0.b14.el7_4.x86_64/jre/bin/java)
   3           java-1.7.0-openjdk.x86_64 (/usr/lib/jvm/java-1.7.0-openjdk-1.7.0.171-2.6.13.0.el7_4.x86_64/jre/bin/java)
*+ 4           /usr/java/jdk-9.0.4/bin/java

Enter to keep the current selection[+], or type selection number:
```
<span class="evidence">sudo alternatives --config java<span>과 같은 옵션으로 JDK10을 설치 할 수가 있다.

마지막으로 환경변수 등록이 필요한데
```console
[azureuser@AzureCentOS src]$ vi /etc/profile

export JAVA_HOME=/usr/local/java
export PATH=$PATH:/usr/local/java/bin:/bin:/sbin

(편집 후 저장 후에)
[azureuser@AzureCentOS src]$ sudo source /etc/profile
```
이런식으로 /etc/profile에 환경변수를 등록하여 사용하면 된다. 위의 내용을 적고, <span class="evidence">sudo source /etc/profile</span> 명령어를 통하여 변경사항을 등록한다.

추가로 **CLASSPATH**라는 환경변수도 등록이 가능한데, 사용할 클래스들의 위치를 가상머신에게 알려주는 역할을 한다.
만약 클래스패스 변수가 없다면, 각각 클래스 패스를 지정해야된다. 이 뜻은 클래스가 여러 경로에 분산되어 있을 때 일일히 클래스패스를 명시해야되기 때문에 자주 쓰는 라이브러리 또는 api같은 경우에는 등록을 하는 것이 좋다.

따라서 자주 쓰는 라이브러리같은 경우에는 클래스 패스를 등록을 하는게 좋다.
```console
[azureuser@AzureCentOS src]$ vi /etc/profile
export CLASSPATH=$JAVA_HOME/jre/lib:$JAVA_HOME/lib/tools.jar
```

필자는 이와 같이 tools.jar과 jre/lib폴더를 추가하였다.

## 트러블 슈팅
환경 변수를 등록할때를 보면 PATH 부분을 저장 후에 리눅스의 기본 모든 명령어들이 사용이 안되는 현상이 발생했다.

그 이유는 etc/profile에 PATH를 등록할때 루트(/)의 bin과 sbin의 명령어의 PATH가 날라가서 충돌이 발생하는 현상이 발생한다. 

따라서 PATH의 환경변수를 사용할 때는 
<span class="evidence">export PATH=$PATH:/usr/local/java/bin:/bin:/sbin</span>
부분 중에 <span class="evidence">:/bin:/sbin</span>을 추가적으로 PATH에 등록하면 해결이 된다.

## 마치면서
추가로 필요하다면 JRE도 위의 방식과 동일한 방법으로 설치하면 된다.

다음 글은 Tomcat 설치와 환경변수 등록 및 Nginx Reverse Proxy설정까지 하는 것으로 포스팅을 해보겠다.

[^1]:http://www.oracle.com/technetwork/java/javase/downloads/jdk10-downloads-4416644.html
[^2]:http://www.oracle.com/technetwork/java/javase/downloads/jdk9-downloads-3848520.html
[^3]:http://jdm.kr/blog/74
[^4]:http://www.myservlab.com/64