---
emoji: ๐งข
title: ๋ฆฌ๋์ค(CentOS7)์์ ์๋ฐ ๊ฐ๋ฐํ๊ฒฝ ๊ตฌ์ถํ๊ธฐ - JDK10 ์ค์นํ๊ธฐ
date: 2018-07-03 10:50:00 +0900
author: ๊ฐ๋ฐํ์
tags: 
    - Linux
    - centOS7
    - JDK
    - Java
    - setting_environment
categories: ์ธํ๋ผ
---

```toc
```

## ๊ฐ์
์ค๋์ Centos7์์ Java ๊ฐ๋ฐํ๊ฒฝ์ ๊ตฌ์ฑํ๋ ์ฒซ๋ฒ์งธ ๋จ์ถ์ธ Java(JDK)๋ฅผ ์ค์น ํ์ ํ๊ฒฝ๋ณ์๊น์ง ์ค์ ํ๋ ๊ฒ์ ์ ์ด๋ณด๋ ค๊ณ  ํ๋ค.
## ์ด์์ฒด์  ํ๊ฒฝ
### ๋ฆฌ๋์ค
    1. ๋ฆฌ๋์ค ๋ฐฐํฌ๋ฐ ๋ฒ์ 
    2. ๋ฆฌ๋์ค ์ปค๋ ๋ฒ์ 

1. ๋ฆฌ๋์ค ๋ฐฐํฌํ ๋ฒ์ 
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
1. ๋ฆฌ๋์ค ์ปค๋ ๋ฒ์ 
```console
[azureuser@AzureCentOS ~]$ yum list installed | grep ^kernel
kernel.x86_64                          3.10.0-327.18.2.el7            @updates
kernel.x86_64                          3.10.0-327.28.2.el7            @updates
kernel.x86_64                          3.10.0-862.3.2.el7             @updates
kernel-headers.x86_64                  3.10.0-862.3.2.el7             @updates
kernel-tools.x86_64                    3.10.0-862.3.2.el7             @updates
kernel-tools-libs.x86_64               3.10.0-862.3.2.el7             @updates
```

์ปค๋ ๋ฒ์ ๊ณผ ๋ฐฐํฌํ ๋ฒ์ ์ ์์ ์ฝ๋์ ๊ฐ์ด CentOS-7.5๋ฒ์ ๊ณผ 3.10.0 ์ปค๋์ ์ฌ์ฉํ๋ค. 


## JDK ์ค์นํ๊ธฐ
์ด๊ธฐ์๋ ์๋ JDK9์ ์ค์นํ๋ ค ํ์ผ๋, ๋์จ์ง ์ผ๋ง ์๋์ Java10 [^1]์ผ๋ก ํตํฉ์ด ๋์๋์ง ํ์ฌ JDK9๋ *End of support* [^2]์ํ์ด๋ค.(์๋ฌด๋๋ Java10์ผ๋ก ํตํฉ์ด ๋ ๊ฒ๊ฐ๋ค.) ๋ฐ๋ผ์ Java๋ฒ์ ์ Java10 [^1]์ผ๋ก ์ค์น๋ฅผ ์งํํ๋ค.

๋ฐฉ๋ฒ์ ์์ค๋ฅผ ๋ค์ด๋ก๋ ๋ฐ์์ ์ค์นํ๋ ๋ฐฉ๋ฒ๊ณผ
RPM ๋ค์ด๋ก๋๋ฅผ ํตํ์ฌ yum์ผ๋ก ์ค์นํ๋ ๋ฐฉ๋ฒ์ด ์๋ค.

์ฌ๊ธฐ์๋ ๋ ๋ฐฉ๋ฒ ๋ชจ๋ ๋ค๋ค๋ณด๊ธฐ๋ก ํ๋ค.
### JDK10 Install Using Downloaded JDK10 Binary file
***
1. STEP 1 - JDK10 ์์ค ๋ค์ด๋ก๋ํ๊ธฐ
2. STEP 2 - JDK10 ๋ช๋ น์ด ๋ฑ๋ก
3. STEP 3 - JDK10 ์ค์น ํ์ธ

### JDK10 Install Using Downloaded JDK10 RPM file
***
1. STEP 1 - JDK10 RPM ๋ค์ด๋ก๋ํ๊ธฐ
2. STEP 2 - JDK10 ์ค์น ํ๊ธฐ

***
#### 1.1 STEP 1 - JDK10 ์์ค ๋ค์ด๋ก๋ํ๊ธฐ

๋จผ์  wget์ ์ด์ฉํ๊ธฐ ๋๋ฌธ์ wget์ด ์ค์น๋์ด ์๋์ง๋ถํฐ ํ์ธํ๋ค.
(Minimal๋ฒ์  ์ผ ๊ฒฝ์ฐ์๋ wget์ ์ค์น๋์ด ์๋ ๊ฒ์ผ๋ก ์๊ณ  ์๋ค.)

```console
[azureuser@AzureCentOS ~]$ yum list installed | grep wget
wget.x86_64                            1.14-15.el7_4.1                @base
```
<span class="evidence">yum list installed</span>
ํด๋น ๋ช๋ น์ด๋ก ์ค์น๋ ๋ช๋ น์ด๋ฅผ ํ์ธ ํ  ์๊ฐ ์๋๋ฐ 
<span class="evidence">| grep wget</span>
ํ์ดํ ์ฐ์ฐ [^3]๊ณผ grep์ ํตํด wget์ด ์ค์น๋์๋์ง ํ์ธ ํ  ์๊ฐ ์๋ค. ๋น์ฐํ๊ฒ๋ wget์๋ฆฌ์ ๋ค๋ฅธ ํจํค์ง๋ก ์๋ ฅํ๋ฉด ๋ค๋ฅธ ํจํค์ง๋ ํ์ธ ํ  ์๊ฐ ์๋ค.

ํ์ฌ JDK10์ Latest Version์ 10.0.1์ด๋ค.
```console
[azureuser@AzureCentOS local]$ sudo wget --no-cookies --no-check-certificate --header "Cookie: oraclelicense=accept-securebackup-cookie" \
  http://download.oracle.com/otn-pub/java/jdk/10.0.1+10/fb4372174a714e6b8c52526dc134031e/jdk-10.0.1_linux-x64_bin.tar.gz
```
ํด๋น ๋ช๋ น์ด๋ฅผ ์ฃผ์ด์ ์๋ฐ10 JDK ์์คํ์ผ์ ๋ค์ด๋ก๋ ๋ฐ๋๋ค.
๋์ ๊ฐ์ ๊ฒฝ์ฐ์๋ ํด๋น ์์ค๋ฅผ <span class="evidence">/usr/local/src</span>์ ๋ฃ์ด๋จ๋๋ฐ Java์ ์์น๋ <span class="evidence">/usr/local/java-* </span>์ผ๋ก ํ๊ณ  ์ถ๊ธฐ๋๋ฌธ์ ์์ถํ๋ ๋ฐ๋ก ํด๋น ํด๋์ ํ๋ฆฌ๋๋ก ์ต์์ ์ถ๊ฐํ๊ฒ ๋ค.
```console
tar zxf jdk-10.0.1_linux-x64_bin.tar.gz -C /usr/local
```
๊ทธ ํ์ jdk-10.0.1์ /usr/local/java๋ก ์ฌ์ฉํ๊ธฐ ์ํด์ ์ฌ๋ณผ๋ฆญ๋งํฌ [^4]๋ฅผ ์์ฑํ๋ค. 
```console
ln -s /usr/local/jdk-10.0.1 /usr/local/java
```
#### 1.2 STEP 2 - JDK10 ๋ช๋ น์ด ๋ฑ๋ก

์์ถํ๊ธฐ์ ์ฌ๋ณผ๋ฆญ๋งํฌ ์์ฑ๊น์ง ๋ง์น ๋ค์์๋ ์ด์ ๋ ๋ช๋ น์ด ๋ฑ๋กํ๋ ์ ์ฐจ๊ฐ ํ์ํ๋ค.

```console
alternatives --install /usr/bin/java java /usr/local/bin/java 1
alternatives --config java

alternatives --install /usr/bin/jar jar /usr/local/java/bin/jar 1
alternatives --install /usr/bin/javac javac /usr/local/java/bin/javac 1

alternatives --set jar /usr/local/java/bin/jar
alternatives --set javac /usr/local/java/bin/javac
```

alternatives๋ช๋ น์ด๋ฅผ ํตํด java์ jar, javac ๋ช๋ น์ด๋ฅผ ๋ฑ๋กํ๋ค.

#### 1.3 STEP 3 - JDK10 ์ค์น ํ์ธ

STEP 1, 2๋ฅผ ๋๋ธ ํ๋ผ๋ฉด ์ ์์ ์ธ ๊ฒฝ์ฐ์๋ 

```console
[azureuser@AzureCentOS local]$ java -version java -version
java 10 2018-04-17
Java(TM) SE Runtime Environment 18.3 (build 10+46)
Java HotSpot(TM) 64-Bit Server VM 18.3 (build 10+46, mixed mode)

[azureuser@AzureCentOS local]$ javac -version
javac 10.0.1
```
์ด๋ฐ์์ผ๋ก ๋ฑ๋กํ ๋ช๋ น์ด์ ๋ํ ๊ฒฐ๊ณผ ๊ฐ์ด ์ ์์ ์ผ๋ก ์ถ๋ ฅ์ด ๋๋ค.

***
#### 2.1 STEP 1 - JDK10 RPM ๋ค์ด๋ก๋ํ๊ธฐ
```console
[azureuser@AzureCentOS src]$ sudo wget --no-cookies --no-check-certificate --header "Cookie: oraclelicense=accept-securebackup-cookie" \
> http://download.oracle.com/otn-pub/java/jdk/10.0.1+10/fb4372174a714e6b8c52526dc134031e/jdk-10.0.1_linux-x64_bin.rpm
```
1.1๊ณผ ๋ง์ฐฌ๊ฐ์ง๋ก wget์ ์ด์ฉํ์ฌ, rpm์ ๋ค์ด๋ก๋ ๋ฐ๋๋ค.

#### 2.2 STEP 2 - JDK10 ์ค์น ํ๊ธฐ
```console
[azureuser@AzureCentOS src]$ sudo yum localinstall jdk-10.0.1_linux-x64_bin.rpm
```
๊ทธ ํ์ localinstall๋ก ํตํ์ฌ ๋ก์ปฌ๋ก ๋ค์ด๋ก๋ ๋ฐ์์ง rpm ํ์ผ์ yum์ ํตํด์ ์ค์นํ๋ค.

๊ทธ ํ์ ๋ 1.3๊ณผ ๋ง์ฐฌ๊ฐ์ง๋ก ๋ฒ์ ํ์ธ์ ํ๋ค.

๋ง์ผ, JDK๊ฐ ์ฌ๋ฌ๊ฐ์ง๊ฐ ์ค์น ๋ ๊ฒฝ์ฐ์ ์๋ก ๋ฐ์ JDK๋ฅผ ์ ํํด์ผ๋๋ ์ํฉ์ด๋ผ๋ฉด, 

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
<span class="evidence">sudo alternatives --config java<span>๊ณผ ๊ฐ์ ์ต์์ผ๋ก JDK10์ ์ค์น ํ  ์๊ฐ ์๋ค.

๋ง์ง๋ง์ผ๋ก ํ๊ฒฝ๋ณ์ ๋ฑ๋ก์ด ํ์ํ๋ฐ
```console
[azureuser@AzureCentOS src]$ vi /etc/profile

export JAVA_HOME=/usr/local/java
export PATH=$PATH:/usr/local/java/bin:/bin:/sbin

(ํธ์ง ํ ์ ์ฅ ํ์)
[azureuser@AzureCentOS src]$ sudo source /etc/profile
```
์ด๋ฐ์์ผ๋ก /etc/profile์ ํ๊ฒฝ๋ณ์๋ฅผ ๋ฑ๋กํ์ฌ ์ฌ์ฉํ๋ฉด ๋๋ค. ์์ ๋ด์ฉ์ ์ ๊ณ , <span class="evidence">sudo source /etc/profile</span> ๋ช๋ น์ด๋ฅผ ํตํ์ฌ ๋ณ๊ฒฝ์ฌํญ์ ๋ฑ๋กํ๋ค.

์ถ๊ฐ๋ก **CLASSPATH**๋ผ๋ ํ๊ฒฝ๋ณ์๋ ๋ฑ๋ก์ด ๊ฐ๋ฅํ๋ฐ, ์ฌ์ฉํ  ํด๋์ค๋ค์ ์์น๋ฅผ ๊ฐ์๋จธ์ ์๊ฒ ์๋ ค์ฃผ๋ ์ญํ ์ ํ๋ค.
๋ง์ฝ ํด๋์คํจ์ค ๋ณ์๊ฐ ์๋ค๋ฉด, ๊ฐ๊ฐ ํด๋์ค ํจ์ค๋ฅผ ์ง์ ํด์ผ๋๋ค. ์ด ๋ป์ ํด๋์ค๊ฐ ์ฌ๋ฌ ๊ฒฝ๋ก์ ๋ถ์ฐ๋์ด ์์ ๋ ์ผ์ผํ ํด๋์คํจ์ค๋ฅผ ๋ช์ํด์ผ๋๊ธฐ ๋๋ฌธ์ ์์ฃผ ์ฐ๋ ๋ผ์ด๋ธ๋ฌ๋ฆฌ ๋๋ api๊ฐ์ ๊ฒฝ์ฐ์๋ ๋ฑ๋ก์ ํ๋ ๊ฒ์ด ์ข๋ค.

๋ฐ๋ผ์ ์์ฃผ ์ฐ๋ ๋ผ์ด๋ธ๋ฌ๋ฆฌ๊ฐ์ ๊ฒฝ์ฐ์๋ ํด๋์ค ํจ์ค๋ฅผ ๋ฑ๋ก์ ํ๋๊ฒ ์ข๋ค.
```console
[azureuser@AzureCentOS src]$ vi /etc/profile
export CLASSPATH=$JAVA_HOME/jre/lib:$JAVA_HOME/lib/tools.jar
```

ํ์๋ ์ด์ ๊ฐ์ด tools.jar๊ณผ jre/libํด๋๋ฅผ ์ถ๊ฐํ์๋ค.

## ํธ๋ฌ๋ธ ์ํ
ํ๊ฒฝ ๋ณ์๋ฅผ ๋ฑ๋กํ ๋๋ฅผ ๋ณด๋ฉด PATH ๋ถ๋ถ์ ์ ์ฅ ํ์ ๋ฆฌ๋์ค์ ๊ธฐ๋ณธ ๋ชจ๋  ๋ช๋ น์ด๋ค์ด ์ฌ์ฉ์ด ์๋๋ ํ์์ด ๋ฐ์ํ๋ค.

๊ทธ ์ด์ ๋ etc/profile์ PATH๋ฅผ ๋ฑ๋กํ ๋ ๋ฃจํธ(/)์ bin๊ณผ sbin์ ๋ช๋ น์ด์ PATH๊ฐ ๋ ๋ผ๊ฐ์ ์ถฉ๋์ด ๋ฐ์ํ๋ ํ์์ด ๋ฐ์ํ๋ค. 

๋ฐ๋ผ์ PATH์ ํ๊ฒฝ๋ณ์๋ฅผ ์ฌ์ฉํ  ๋๋ 
<span class="evidence">export PATH=$PATH:/usr/local/java/bin:/bin:/sbin</span>
๋ถ๋ถ ์ค์ <span class="evidence">:/bin:/sbin</span>์ ์ถ๊ฐ์ ์ผ๋ก PATH์ ๋ฑ๋กํ๋ฉด ํด๊ฒฐ์ด ๋๋ค.

## ๋ง์น๋ฉด์
์ถ๊ฐ๋ก ํ์ํ๋ค๋ฉด JRE๋ ์์ ๋ฐฉ์๊ณผ ๋์ผํ ๋ฐฉ๋ฒ์ผ๋ก ์ค์นํ๋ฉด ๋๋ค.

๋ค์ ๊ธ์ Tomcat ์ค์น์ ํ๊ฒฝ๋ณ์ ๋ฑ๋ก ๋ฐ Nginx Reverse Proxy์ค์ ๊น์ง ํ๋ ๊ฒ์ผ๋ก ํฌ์คํ์ ํด๋ณด๊ฒ ๋ค.

[^1]:http://www.oracle.com/technetwork/java/javase/downloads/jdk10-downloads-4416644.html
[^2]:http://www.oracle.com/technetwork/java/javase/downloads/jdk9-downloads-3848520.html
[^3]:http://jdm.kr/blog/74
[^4]:http://www.myservlab.com/64